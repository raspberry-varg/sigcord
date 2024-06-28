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
import { createSignal } from './Reactivity.js';
import type { ReactiveOptions } from './Reactivity.js';
import { PatchTarget, PatchTargetBitField } from './RenderingEngine.js';
import { Reactive } from '@reactively/core';
import type { PropsBase } from './MenuView/ViewBase.js';
import { EffectInstance } from './Reactivity.js';
import { Navigation } from './Navigation.js';
import {
  clearReactiveContext,
  setReactiveContext,
} from './ReactiveBuiltIns.js';

export interface MenuControllerAPI {
  // render API
  start(options?: Partial<RenderOptions>): Promise<void>;
  reply(
    options: Omit<Partial<RenderOptions<string>>, 'forceReply'>
  ): Promise<void>;
  /**@deprecated Please use `.start` instead. */
  render(
    options?: Omit<Partial<RenderOptions<string>>, 'forceReply'>
  ): Promise<void>;
  // listener API
  onRender(callback: () => unknown, once?: boolean): void;
  awaitRender(): Promise<void>;
  onEnd(callback: (endReason: string | null) => unknown): void;
  awaitEnd(): Promise<string | null>;
}

export interface ControllerContext {
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

export function MenuController<
  MenuProps extends NonNullable<unknown> = NonNullable<unknown>,
  ViewId extends string = string,
  AllProps extends PropsBase = PropsBase
>(
  menuId: string,
  initialViewId: string,
  registeredViews: View<AllProps>[],
  interaction: RepliableInteraction,
  initProps: MenuProps
): MenuControllerAPI {
  function createSynapse(): Synapse {
    const $: Synapse = {
      ctx,
      appendEmbeds: (...embeds: EmbedBuilder[]) =>
        renderer.appendEmbeds(...embeds),
      prependEmbeds: (...embeds: EmbedBuilder[]) =>
        renderer.prependEmbeds(...embeds),
      swap: (idOrView: string | View, ...args: unknown[] | [PropsBase]) => {
        clearViewArtifacts();

        const incomingIsView = typeof idOrView !== 'string';
        const view = incomingIsView ? idOrView : getView(idOrView);
        if (incomingIsView) {
          renderer.queueViewSwapWithProps(view as View, args[0] as PropsBase);
        } else {
          renderer.queueViewSwap(view as View, args);
        }
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
        try {
          if (renderer.isCurrentViewReactive()) {
            setReactiveContext(props.$);
          }
          await callback(response);
        } finally {
          clearReactiveContext();
        }
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
        return createSignal(fnOrMaybeSignal, {}, PatchTarget.None);
      },
      createSignal<T>(
        fnOrValue: T | (() => T) | undefined = undefined,
        params = {},
        patchTarget = PatchTarget.None
      ) {
        const s = createSignal(fnOrValue, params, patchTarget);
        if (patchTarget !== PatchTarget.None) {
          registerEffect(
            () => {
              s.get();
            },
            params,
            patchTarget
          );
        }
        return s;
      },
      createEmbedSignal: (closure, params = {}) => {
        const s = createSignal(closure, params, PatchTarget.Embeds);
        $.createEmbedEffect(() => {
          s.get();
        }, params);
        return s;
      },
      createComponentSignal: (closure, params = {}) => {
        const s = createSignal(closure, params, PatchTarget.Components);
        $.createComponentEffect(() => {
          s.get();
        }, params);
        return s;
      },
      createEffect: (fn, params, patchTarget) => {
        registerEffect(fn, params, patchTarget);
      },
      createEmbedEffect: (fn, params) => {
        registerEffect(fn, params, PatchTarget.Embeds);
      },
      createComponentEffect: (fn, params) => {
        registerEffect(fn, params, PatchTarget.Components);
      },
      goTo(view, props) {
        const currentView = renderer.getCurrentView();
        assert(
          currentView,
          'Tried to navigate before initial render in a reactive view.'
        );
        if (renderer.isCurrentViewReactive()) {
          const reactivePayload = renderer.getReactivePayload();
          assert(
            reactivePayload,
            'Tried to navigate before initial render in a reactive view.'
          );
          navigation.pushReactive(currentView, reactivePayload, effects);
          effects = [];
        } else {
          navigation.push(currentView);
        }
        renderer.queueViewSwapWithProps(view as View, props, true);
      },
      goToCached: (view, props) => {
        const currentView = renderer.getCurrentView();
        assert(
          currentView,
          'Tried to navigate before initial render in a reactive view.'
        );
        if (renderer.isCurrentViewReactive()) {
          const reactivePayload = renderer.getReactivePayload();
          assert(
            reactivePayload,
            'Tried to navigate before initial render in a reactive view.'
          );
          navigation.pushReactive(currentView, reactivePayload, effects);
          effects = [];
        } else {
          navigation.push(currentView);
        }
        renderer.queueViewSwapWithProps(view, props);
      },
      goBack: () => {
        assert(
          !navigation.empty(),
          'Tried to navigate backwards without a parent view. Have you called goTo() in the parent view?'
        );
        const payload = navigation.pop();
        effects = payload.effects;
        renderer.queueNavigation(payload);
      },
      canGoBack: () => {
        return !navigation.empty();
      },
    };
    return $;
  }
  function registerEffect(
    fn: () => void,
    params: ReactiveOptions | undefined,
    patchTarget = PatchTarget.None
  ): void {
    let version = 0;
    const signal = createSignal(
      () => {
        fn();
        version++;
        return version;
      },
      { ...params },
      patchTarget
    );
    signal.get();
    effects.push({
      signal,
      previousVersion: version,
      patch: patchTarget,
    });
  }
  function getView(id: string): View<AllProps> {
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
  const views = new Map<string, View<AllProps>>(
    registeredViews.map((v) => [v.id, v])
  );
  const initialView = views.get(initialViewId);
  assert(
    initialView,
    `View with initial view id=${initialViewId} is not registered.`
  );
  const props = buildProps({ ...initialView.defaults, ...initProps }, builtins);
  const renderer = new RenderingEngine();
  const patcher = new InteractionPatcher(interaction, props);
  const listeners: MenuControllerListeners = {
    onRender: new Listener(),
    onEnd: new Listener(),
  };
  const navigation = new Navigation();
  const componentCallbacks = new Map<
    MenuViewComponentId,
    MessageComponentCallback<any>
  >();
  let effects: EffectInstance[] = [];

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
    if (collector.hasEnded()) {
      return PatchTarget.None;
    }
    // do not wait for reactivity to render a queued view
    if (renderer.hasQueuedView()) {
      return PatchTarget.All;
    }
    if (renderer.isCurrentViewReactive()) {
      let patchTargets: PatchTargetBitField = manualPatchQueued;
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
      if (renderer.hasQueuedNavigation()) {
        patchTargets |= PatchTarget.All;
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
      renderer.viewDefinition ? renderer.viewDefinition.id : initialViewId
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
    try {
      if (renderer.isCurrentViewReactive()) {
        setReactiveContext(props.$);
      }
      await interactionCallback(collected);
    } finally {
      clearReactiveContext();
    }

    const patchTargets = getPatchTargets();
    if (patchTargets !== PatchTarget.None) {
      await update(patchTargets);
    }
  }

  async function initialRender(options: Partial<RenderOptions>) {
    const initialView = getView(options.view ?? initialViewId);
    assert(
      !('isSubView' in initialView) || !initialView.isSubView,
      `Tried to render subview "${initialView.id}" directly. ` +
        'Subviews must be swapped into.'
    );
    renderer.queueViewSwap(initialView as View, []);
    renderer.queueRender();
    patcher.mountInteraction(getInteractionToPatch());
    beforeRender();
    try {
      const payload = await renderer.render(props);
      await patcher.patch(payload, options);
    } finally {
      afterRender();
    }
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
