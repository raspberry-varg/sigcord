import type {
  EmbedBuilder,
  CollectedMessageInteraction,
  MessageComponentInteraction,
  RepliableInteraction,
} from 'discord.js';
import { Synapse } from './Synapse.js';
import { View, ViewProps, MenuContext } from './FunctionalMenuView.js';
import { IntrinsicMenuProps } from './InteractiveMenu.js';
import { SmartComponentType } from './SmartComponents.js';
import { assert, assertAndReturn } from '../util/Assertions.js';
import { Listener } from './Listener.js';
import { logger } from '../util/Logger.js';
import { RenderingEngine } from './RenderingEngine.js';
import { InteractionPatcher } from './InteractionPatcher.js';
import { CollectorService } from './CollectorService.js';
import { TimeoutEmbed } from './PrebuiltEmbeds.js';
import { Signal, createSignal } from './Reactivity.js';
import type { ReactiveOptions } from './Reactivity.js';
import { PatchTarget, PatchTargetBitField } from './RenderingEngine.js';
import { Reactive } from '@reactively/core';

export interface ControllerContext {
  // onLoadCallbacks: OnLoadCallback[];
  appendedEmbeds: EmbedBuilder[];
  prependedEmbeds: EmbedBuilder[];
  smartComponents: Map<string, { component: any; callback: any }>;
  queuedViewChange: string | null;
}

export interface MessageComponentCallback<
  T extends MessageComponentInteraction = MessageComponentInteraction
> {
  (callback: T): Promise<unknown> | unknown;
}

export interface RenderOptions<ViewIds extends string = string> {
  /**
   * Reply or followup instead of editing or updating the original message.
   * @default false
   */
  forceReply: boolean | false;
  view?: ViewIds;
}

const DefaultRenderOptions: RenderOptions = {
  forceReply: false,
} as const;

const DEFAULT_IDLE = 60_000;

const DefaultProperties: IntrinsicMenuProps = {
  renderAfterHandledInteraction: true,
  idleTimeMs: DEFAULT_IDLE,
  ephemeral: false,
};

type MenuViewComponentId = string;

interface MenuControllerListeners {
  onRender: Listener<void>;
  onEnd: Listener<string | null>;
}

interface EffectInstance {
  signal: Signal<number>;
  previousVersion: number;
  patch?: PatchTarget;
}

export function MenuController<
  MenuProps extends NonNullable<unknown> = NonNullable<unknown>,
  ViewId extends string = string
>(
  menuId: string,
  initialViewId: string,
  registeredViews: View[],
  interaction: RepliableInteraction,
  initProps: MenuProps
) {
  function createSynapse(): Synapse {
    return {
      ctx,
      appendEmbeds: (...embeds: EmbedBuilder[]) =>
        renderer.appendEmbeds(...embeds),
      prependEmbeds: (...embeds: EmbedBuilder[]) =>
        renderer.prependEmbeds(...embeds),
      swap: (id: string, ...args: unknown[]) => {
        clearViewArtifacts();
        renderer.queueViewSwap(getView(id), args);
      },
      component: ({ id, component, controller }) => {
        const componentId = createComponentId(id);
        component.setCustomId(componentId);
        collector.onComponent(componentId, controller);
        return component;
      },
      showModal: async (interaction, modal) => {
        latestModal.customId = modal.data.custom_id ?? '';
        return await interaction.showModal(modal);
      },
      awaitModalSubmit: async (interaction, options) => {
        latestModal.interactionId = interaction.id;
        const response = await interaction
          .awaitModalSubmit(options)
          .catch(() => {
            logger.debug('Modal ended without receiving a response.');
            flushModal();
            return null;
          });
        if (
          !response ||
          (latestModal.interactionId.length &&
            latestModal.interactionId !== interaction.id) ||
          (latestModal.customId.length &&
            latestModal.customId !== response.customId)
        ) {
          return null;
        }
        flushModal();
        return response;
      },
      onModalSubmit: async (interaction, options, callback) => {
        latestModal.interactionId = interaction.id;
        const response = await interaction
          .awaitModalSubmit(options)
          .catch(() => {
            logger.debug('Modal ended without receiving a response.');
            flushModal();
            return;
          });
        if (
          !response ||
          latestModal.interactionId !== interaction.id ||
          latestModal.customId !== response.customId
        ) {
          return;
        }
        flushModal();
        await callback(response);
      },
      setIdleMs: (idleMilliseconds: number) => {
        assert(
          idleMilliseconds > 0,
          `Idle time must be greater than 0 milliseconds, got [${idleMilliseconds}].`
        );
        updateListenerIdle(idleMilliseconds);
      },
      setIdleSec: (idleSeconds: number) => {
        assert(
          idleSeconds > 0,
          `Idle time must be greater than 0 seconds, got [${idleSeconds}].`
        );
        updateListenerIdle(idleSeconds * 1_000);
      },
      close: async () => await closeMenu(),
      skipRender: (shouldSkip = true) => {
        skipRender = shouldSkip;
      },
      stop: (reason?: string) => stopMenu(reason),
      queueRender: (queueRender = true) => {
        if (queueRender) {
          manualPatchQueued |= PatchTarget.All;
        } else {
          manualPatchQueued = 0;
        }
      },
      patch: (...targets) => {
        manualPatchQueued |= targets.reduce<PatchTargetBitField>(
          (bitField, target) => {
            return bitField | target;
          },
          PatchTarget.None
        );
      },
      signalFrom: (fnOrMaybeSignal) => {
        if (fnOrMaybeSignal instanceof Reactive) {
          return fnOrMaybeSignal;
        }
        return createSignal(fnOrMaybeSignal, {});
      },
      createSignal<T>(
        fnOrValue: T | (() => T) | undefined = undefined,
        params = undefined
      ) {
        return createSignal(fnOrValue, params);
      },
      createEffect: (fn, params) => {
        registerEffect(fn, params);
      },
      createEmbedEffect: (fn, params) => {
        registerEffect(fn, params, PatchTarget.Embeds);
      },
      createComponentEffect: (fn, params) => {
        registerEffect(fn, params, PatchTarget.Components);
      },
    };
  }
  function registerEffect(
    fn: () => void,
    params: ReactiveOptions | undefined,
    patchTarget?: PatchTarget
  ): void {
    let version = 0;
    const signal = createSignal(
      () => {
        fn();
        version++;
        console.log(`returning version=${version}`);
        return version;
      },
      { ...params }
    );
    signal.get();
    effects.push({
      signal,
      previousVersion: version,
      patch: patchTarget,
    });
  }
  function getView(id: string): View {
    const view = views.get(id);
    assert(view, `"${id}" is not a registered view.`);
    return view;
  }
  function getInteractionToPatch(): RepliableInteraction {
    return props.renderAfterHandledInteraction && collector.lastCollected
      ? collector.lastCollected
      : interaction;
  }
  function stopMenu(reason?: string) {
    collector.stop(reason);
    cleanup();
  }
  function cleanup() {
    // TODO(@raspberry-varg): Implement relevant cleanup.
    return;
  }
  const ctx: MenuContext = {
    get interaction(): RepliableInteraction {
      return getInteractionToPatch();
    },
    initialInteraction: interaction,
    get idleTimeMs(): number {
      return idle;
    },
  };
  const builtins = createSynapse();
  const props = buildProps(initProps, builtins);
  const views = new Map<string, View>(registeredViews.map((v) => [v.id, v]));
  const renderer = new RenderingEngine();
  const patcher = new InteractionPatcher(interaction, props);
  const listeners: MenuControllerListeners = {
    onRender: new Listener(),
    onEnd: new Listener(),
  };
  const componentCallbacks = new Map<
    MenuViewComponentId,
    MessageComponentCallback<any>
  >();
  const effects: EffectInstance[] = [];

  let idle: number =
    props.idleTimeMs === undefined
      ? DEFAULT_IDLE
      : assertAndReturn(
          props.idleTimeMs,
          (t) => t > 0,
          `Idle time must be greater than 0 milliseconds, got [${props.idleTimeMs}].`
        );
  const collector = new CollectorService(listeners.onEnd);
  const latestModal = {
    interactionId: '',
    customId: '',
  };
  let skipRender = false;
  let manualPatchQueued: PatchTargetBitField = 0;

  function getPatchTargets(): PatchTargetBitField {
    logger.debug({
      skipRender,
      collectorEnded: collector.hasEnded(),
      isCurrentViewReactive: renderer.isCurrentViewReactive(),
      rendererHasQueuedView: renderer.hasQueuedView(),
      manualPatchQueued,
    });
    if (skipRender || collector.hasEnded()) {
      return PatchTarget.None;
    }
    // do not wait for reactivity to render a queued view
    if (manualPatchQueued || renderer.hasQueuedView()) {
      return PatchTarget.All;
    }
    if (renderer.isCurrentViewReactive()) {
      let patchTargets: PatchTargetBitField = 0;
      effects.forEach((effect) => {
        const oldVersion = effect.previousVersion;
        const newVersion = effect.signal.get();
        const hasChanged = oldVersion !== newVersion;
        effect.previousVersion = newVersion;
        if (hasChanged && effect.patch !== undefined) {
          patchTargets |= effect.patch;
        }
      });
      logger.debug({ patchTargetBitField: patchTargets });
      if (renderer.hasQueuedEmbeds()) {
        patchTargets |= PatchTarget.Embeds;
      }
      return patchTargets;
    }
    return PatchTarget.All;
  }

  function beforeRender() {
    if (renderer.hasQueuedView()) {
      effects.length = 0;
    }
  }

  function afterRender() {
    skipRender = false;
    manualPatchQueued = 0;
    listeners.onRender.fire();
  }

  function createComponentId(componentId: string): MenuViewComponentId {
    if (componentId.includes(':')) {
      throw new MenuViewComponentError(
        `Internal delimiter uses ':' for MenuViewComponentIds. Please use ` +
          `a different character.`
      );
    }
    return `${menuId}:${
      renderer.view ? renderer.view.id : initialViewId
    }:${componentId}`;
  }

  function clearViewArtifacts() {
    collector.clear();
    componentCallbacks.clear();
    flushModal();
  }

  function flushModal() {
    latestModal.customId = '';
    latestModal.interactionId = '';
  }

  /**
   * Close the Menu and end component listener.
   * - This will also delete ephemeral replies.
   */
  async function closeMenu() {
    stopMenu('close');
    patcher.mountInteraction(interaction);
    return await patcher.delete();
  }

  function getComponentId(rawCustomId: string) {
    const componentIdSplit = rawCustomId.split(':');
    if (componentIdSplit.length !== 3) {
      throw new MenuViewComponentError(
        `customId for '${rawCustomId}' is malformed. Please use ` +
          `'createMessageComponentId()' when defining a new component id.`
      );
    }
    return componentIdSplit.at(-1);
  }

  function onTimeout() {
    cleanup();
    return patchTimeout();
  }

  // TODO: Move collector into a microservice outside of this file.
  function initCollector() {
    const message = patcher.message;
    assert(message, `Unable to initialize collectors; 'message' is undefined.`);
    collector.init({
      idle,
      message,
      onTimeout,
      onCollect,
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.channelId === interaction.channelId,
    });
  }

  function updateListenerIdle(timeMilliseconds: number): void {
    idle = timeMilliseconds;
    collector.updateIdle(timeMilliseconds);
  }

  function handlePrebuiltComponents(collected: CollectedMessageInteraction) {
    const id = collected.customId;
    if (collected.isButton()) {
      switch (id) {
        case SmartComponentType.CloseButton: {
          logger.debug('Closing Menu via official CloseMenuButton');
          closeMenu();
          return true;
        }
      }
    }
    return false;
  }

  async function onCollect(collected: CollectedMessageInteraction) {
    if (handlePrebuiltComponents(collected)) {
      return;
    }

    if (props.renderAfterHandledInteraction) {
      patcher.mountInteraction(collected);
    }

    // route to registered handler
    const interactionCallback = collector.getComponentCallback(
      collected.customId
    );
    if (!interactionCallback) {
      logger.warn(
        `MenuView: No handler defined for ${getComponentId(collected.customId)}`
      );
      return;
    }
    await interactionCallback(collected);

    const patchTargets = getPatchTargets();
    if (patchTargets !== PatchTarget.None) {
      await update(patchTargets);
    }
  }

  async function initialRender(options: Partial<RenderOptions>) {
    const initialView = getView(options.view ?? initialViewId);
    assert(
      !initialView.isSubView,
      `Tried to render subview "${initialView.id}" directly. ` +
        'Subviews must be swapped into.'
    );
    renderer.queueViewSwap(initialView, []);
    renderer.queueRender();
    patcher.mountInteraction(getInteractionToPatch());
    beforeRender();
    const payload = await renderer.render(props);
    await patcher.patch(payload, options);
    afterRender();
  }

  /** Handles subsequent rerenders. */
  async function update(patchTargets: PatchTargetBitField): Promise<void> {
    beforeRender();
    const payload = await renderer.patch(props, patchTargets);
    await patcher.patch(payload, {});
    afterRender();
  }

  /**
   * Force a reply to the initial interaction instead of dynamically rendering.
   */
  async function reply(
    options: Omit<Partial<RenderOptions<ViewId>>, 'forceReply'>
  ) {
    return await start({ ...options, forceReply: true });
  }

  async function patchTimeout() {
    renderer.appendEmbeds(TimeoutEmbed);
    renderer.queueClear(PatchTarget.Components);
    const payload = await renderer.patch(
      props,
      PatchTarget.Embeds | PatchTarget.Content
    );
    await patcher.patch(payload, {});
  }

  /**
   * Render the currently-active view to the original interaction.
   */
  async function start(options: Partial<RenderOptions> = {}) {
    options = { ...DefaultRenderOptions, ...options };
    await initialRender(options);
    initCollector();
  }

  /*
   * Listener API
   */
  function onRender(callback: () => unknown, once = false): void {
    listeners.onRender.do(callback, once);
  }
  function onEnd(callback: (endReason: string | null) => unknown): void {
    listeners.onEnd.do(callback);
  }
  const awaitRender = () => listeners.onRender.asPromise();
  const awaitEnd = () => listeners.onEnd.asPromise();

  return {
    // render API
    reply,
    /**@deprecated Please use `.start` instead. */
    render: start,
    start,
    // listener API
    onRender,
    awaitRender,
    onEnd,
    awaitEnd,
  };
}

function buildProps<Props extends NonNullable<unknown>>(
  initProps: Props,
  builtins: Synapse
): ViewProps<Props> & IntrinsicMenuProps {
  return {
    ...DefaultProperties,
    ...initProps,
    $: builtins,
  };
}

class MenuViewComponentError extends Error {
  constructor(message: string) {
    super(message);
  }
}
