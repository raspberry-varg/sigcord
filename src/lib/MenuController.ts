import {
  type EmbedBuilder,
  type CollectedMessageInteraction,
  type MessageComponentInteraction,
  type RepliableInteraction,
  ModalBuilder,
} from 'discord.js';
import { Synapse, type ModalHandlingOptions } from './Synapse.js';
import { View, ViewProps, MenuContext } from './FunctionalMenuView.js';
import { IntrinsicMenuProps } from './InteractiveMenu.js';
import { SmartComponentType } from './SmartComponents.js';
import { assert, assertAndReturn, assertNotNull } from '../util/Assertions.js';
import { Listener } from './Listener.js';
import { logger } from '../util/Logger.js';
import { RenderingEngine } from './RenderingEngine.js';
import { InteractionPatcher } from './InteractionPatcher.js';
import { CollectorService } from './CollectorService.js';
import { TimeoutEmbed } from './PrebuiltEmbeds.js';
import { createComputed, createEffect, createSignal } from './Reactivity.js';
import { PatchTarget, PatchTargetBitField } from './RenderingEngine.js';
import type { PropsBase } from './MenuView/ViewBase.js';
import { Navigation } from './Navigation.js';
import {
  getCurrentReactiveContext,
  setReactiveContext,
} from './ReactiveBuiltIns.js';
import type { TimeoutEndReason } from '../util/CollectorUtil.js';
import { batch } from '@preact/signals-core';
import { queueUpdateMicrotask } from './MenuUpdateMicrotasks.js';

export interface MenuControllerAPI {
  // render API
  start(options?: Partial<RenderOptions>): Promise<void>;
  reply(
    options: Omit<Partial<RenderOptions<string>>, 'forceReply'>,
  ): Promise<void>;
  /**@deprecated Please use `.start` instead. */
  render(
    options?: Omit<Partial<RenderOptions<string>>, 'forceReply'>,
  ): Promise<void>;
  // listener API
  onRender(callback: () => unknown, once?: boolean): void;
  awaitRender(): Promise<void>;
  onEnd(
    callback: (endReason: TimeoutEndReason | (string & {}) | null) => unknown,
  ): void;
  awaitEnd(): Promise<TimeoutEndReason | (string & {}) | null>;
  onStop(callback: (endReason: string | null) => unknown): void;
  awaitStop(): Promise<string | null>;
  onTimeout(callback: (timeoutReason: TimeoutEndReason) => unknown): void;
  awaitTimeout(): Promise<TimeoutEndReason | null>;
}

export interface ControllerContext {
  appendedEmbeds: EmbedBuilder[];
  prependedEmbeds: EmbedBuilder[];
  smartComponents: Map<string, { component: any; callback: any }>;
  queuedViewChange: string | null;
}

export interface MessageComponentCallback<
  T extends MessageComponentInteraction = MessageComponentInteraction,
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
  onEnd: Listener<TimeoutEndReason | (string & {}) | null>;
  onStop: Listener<string | null>;
  onTimeout: Listener<TimeoutEndReason>;
}

export function MenuController<
  MenuProps extends NonNullable<unknown> = NonNullable<unknown>,
  ViewId extends string = string,
  AllProps extends PropsBase = PropsBase,
>(
  menuId: string,
  initialViewId: string,
  registeredViews: View<AllProps>[],
  interaction: RepliableInteraction,
  initProps: MenuProps,
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
      async showModal(interaction, modalOrOptions) {
        let modal: ModalBuilder;
        let options: ModalHandlingOptions | undefined;
        if (modalOrOptions instanceof ModalBuilder) {
          modal = modalOrOptions;
        } else {
          modal = modalOrOptions.modal;
          options = modalOrOptions;
        }

        latestModal.customId = modal.data.custom_id ?? '';
        await interaction.showModal(modal);
        if (options) {
          await this.onModalSubmit(interaction, options, options.onSubmit);
        }
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

        const patchTargets = getPatchTargets();
        if (patchTargets !== PatchTarget.None) {
          await update(patchTargets);
        }
      },
      setIdleMs: (idleMilliseconds: number) => {
        assert(
          idleMilliseconds > 0,
          `Idle time must be greater than 0 milliseconds, got [${idleMilliseconds}].`,
        );
        updateListenerIdle(idleMilliseconds);
      },
      setIdleSec: (idleSeconds: number) => {
        assert(
          idleSeconds > 0,
          `Idle time must be greater than 0 seconds, got [${idleSeconds}].`,
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
      /**
       * Do not wait for a component collection loop, update immediately.

       * Handy for asynchronous operations such as handling a modal submit.
       */
      doUpdate: async () => {
        const patchTargets = getPatchTargets();
        if (patchTargets !== PatchTarget.None) {
          await update(patchTargets);
        }
      },
      patch: (...targets) => {
        manualPatchQueued |= targets.reduce<PatchTargetBitField>(
          (bitField, target) => {
            return bitField | target;
          },
          PatchTarget.None,
        );
      },
      createSignal<T>(
        fnOrValue: T | undefined = undefined,
        patchTarget = PatchTarget.None,
      ) {
        const s = createSignal(fnOrValue, patchTarget);
        if (patchTarget !== PatchTarget.None) {
          registerEffect(s.get.bind(s), patchTarget);
        }
        return s.split();
      },
      createWritableSignal<T>(
        initialValue: T | undefined = undefined,
        patchTarget = PatchTarget.None,
      ) {
        const s = createSignal(initialValue, patchTarget);
        if (patchTarget !== PatchTarget.None) {
          registerEffect(s.get.bind(s), patchTarget);
        }
        return s;
      },
      createComputed: (fn) => createComputed(fn),
      createEffect: (fn, patchTarget) => {
        registerEffect(fn, patchTarget);
      },
      createEmbedEffect: (fn) => {
        registerEffect(fn, PatchTarget.Embeds);
      },
      createComponentEffect: (fn) => {
        registerEffect(fn, PatchTarget.Components);
      },
      goTo(view, props) {
        const currentView = renderer.getCurrentView();
        assert(
          currentView,
          'Tried to navigate before initial render in a reactive view.',
        );
        if (renderer.isCurrentViewReactive()) {
          const reactivePayload = renderer.getReactivePayload();
          assert(
            reactivePayload,
            'Tried to navigate before initial render in a reactive view.',
          );
          navigation.pushReactive(currentView, reactivePayload);
          setActiveView(null);
        } else {
          navigation.push(currentView);
        }
        renderer.queueViewSwapWithProps(view as View, props, true);
      },
      goToCached: (view, props) => {
        const currentView = renderer.getCurrentView();
        assert(
          currentView,
          'Tried to navigate before initial render in a reactive view.',
        );
        if (renderer.isCurrentViewReactive()) {
          const reactivePayload = renderer.getReactivePayload();
          assert(
            reactivePayload,
            'Tried to navigate before initial render in a reactive view.',
          );
          navigation.pushReactive(currentView, reactivePayload);
          setActiveView(null);
        } else {
          navigation.push(currentView);
        }
        renderer.queueViewSwapWithProps(view, props);
      },
      goBack: () => {
        assert(
          !navigation.empty(),
          'Tried to navigate backwards without a parent view. Have you called goTo() in the parent view?',
        );
        const payload = navigation.pop();
        setActiveView(payload.view);
        renderer.queueNavigation(payload);
      },
      canGoBack: () => {
        return !navigation.empty();
      },
      resumableSuspend: async (action) =>
        await action().then((r) => {
          setReactiveContext($);
          return r;
        }),
    };
    return $;
  }
  function registerEffect(
    fn: () => void,
    patchTarget = PatchTarget.None,
  ): void {
    const currentView = assertNotNull(renderer.getCurrentView());
    const isActiveView = createComputed(() => activeView() === currentView);
    createEffect(() => {
      if (!isActiveView()) {
        logger.debug(
          `Not active view; active=${activeView()?.id}, current=${currentView.id}`,
        );
        return;
      }

      const prevCtx = getCurrentReactiveContext();
      try {
        setReactiveContext(builtins);
        fn();
      } finally {
        setReactiveContext(prevCtx);
      }

      builtins.patch(patchTarget);

      if (patchTarget !== PatchTarget.None && prevCtx !== builtins) {
        // run called outside of a render or update cycle
        queueUpdateMicrotask(builtins);
      }
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
  const [activeView, setActiveView] = builtins.createSignal<View | null>(null);
  const views = new Map<string, View<AllProps>>(
    registeredViews.map((v) => [v.id, v]),
  );
  const initialView = views.get(initialViewId);
  assert(
    initialView,
    `View with initial view id=${initialViewId} is not registered.`,
  );
  const props = buildProps({ ...initialView.defaults, ...initProps }, builtins);
  const renderer = new RenderingEngine();
  const patcher = new InteractionPatcher(interaction, props);
  const listeners: MenuControllerListeners = {
    onRender: new Listener(),
    onEnd: new Listener(),
    onStop: new Listener(),
    onTimeout: new Listener(),
  };
  const navigation = new Navigation();
  const componentCallbacks = new Map<
    MenuViewComponentId,
    MessageComponentCallback<any>
  >();
  let idle: number =
    props.idleTimeMs === undefined
      ? DEFAULT_IDLE
      : assertAndReturn(
          props.idleTimeMs,
          (t) => t > 0,
          `Idle time must be greater than 0 milliseconds, got [${props.idleTimeMs}].`,
        );
  const collector = new CollectorService(listeners);
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
      if (renderer.hasQueuedEmbeds()) {
        patchTargets |= PatchTarget.Embeds;
      }
      if (renderer.hasQueuedNavigation()) {
        patchTargets |= PatchTarget.All;
      }
      logger.debug({ patchTargetBitField: patchTargets });
      return patchTargets;
    }
    return PatchTarget.All;
  }

  function beforeRender() {
    const queued = renderer.getQueuedView();
    if (queued) {
      setActiveView(queued.view);
    } else {
      setActiveView(assertNotNull(renderer.getCurrentView()));
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
          `a different character.`,
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
          `'createMessageComponentId()' when defining a new component id.`,
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
      collected.customId,
    );

    if (!interactionCallback) {
      logger.warn(
        `MenuView: No handler defined for ${getComponentId(collected.customId)}`,
      );
      return;
    }

    const prevContext = getCurrentReactiveContext();
    try {
      // using _resource = withReactiveContext(props.$);
      setReactiveContext(props.$);
      await interactionCallback(collected);
    } catch (e) {
      logger.error(
        `Error occurred while handling a collected component interaction: ${collected.customId}`,
      );
      throw e;
    } finally {
      setReactiveContext(prevContext);
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
        'Subviews must be swapped into.',
    );
    renderer.queueViewSwap(initialView as View, []);
    renderer.queueRender();
    patcher.mountInteraction(getInteractionToPatch());
    beforeRender();
    try {
      const payload = await batch(async () => await renderer.render(props));
      await patcher.patch(payload, options);
    } finally {
      afterRender();
    }
  }

  /** Handles subsequent rerenders. */
  async function update(patchTargets: PatchTargetBitField): Promise<void> {
    beforeRender();
    const payload = await batch(
      async () => await renderer.patch(props, patchTargets),
    );
    await patcher.patch(payload, {});
    afterRender();
  }

  /**
   * Force a reply to the initial interaction instead of dynamically rendering.
   */
  async function reply(
    options: Omit<Partial<RenderOptions<ViewId>>, 'forceReply'>,
  ) {
    return await start({ ...options, forceReply: true });
  }

  async function patchTimeout() {
    renderer.appendEmbeds(TimeoutEmbed);
    renderer.queueClear(PatchTarget.Components);
    const payload = await renderer.patch(
      props,
      PatchTarget.Embeds | PatchTarget.Content,
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
  function onEnd(
    callback: (endReason: TimeoutEndReason | (string & {}) | null) => unknown,
  ): void {
    listeners.onEnd.do(callback);
  }
  function onStop(callback: (stopReason: string | null) => unknown): void {
    listeners.onStop.do(callback);
  }
  function onTimeoutDo(
    callback: (timeoutReason: TimeoutEndReason) => unknown,
  ): void {
    listeners.onTimeout.do(callback);
  }
  const awaitRender = () => listeners.onRender.asPromise();
  const awaitEnd = () => listeners.onEnd.asPromise();
  const awaitStop = () => listeners.onStop.asPromise();
  const awaitTimeout = () => listeners.onTimeout.asPromise();

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
    onStop,
    awaitStop,
    onTimeout: onTimeoutDo,
    awaitTimeout,
  };
}

function buildProps<Props extends NonNullable<unknown>>(
  initProps: Props,
  builtins: Synapse,
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
