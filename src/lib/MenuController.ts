import {
  type EmbedBuilder,
  type CollectedMessageInteraction,
  type MessageComponentInteraction,
  type RepliableInteraction,
  ModalBuilder,
  type MessageComponentBuilder,
} from 'discord.js';
import { Synapse } from './menu/synapse.js';
import { type ModalHandlingOptions } from './interactivity/modalHandling.js';
import { ClassViewProps } from './FunctionalMenuView.js';
import { MenuContext } from './menu/menuContext.js';
import { View } from './views/view.js';
import { IntrinsicMenuProps } from './InteractiveMenu.js';
import { assert, assertAndReturn, assertNotNull } from '../util/Assertions.js';
import { Listener } from './Listener.js';
import { logger, LogLevel, shouldLog } from '../util/Logger.js';
import { RenderingEngine } from './RenderingEngine.js';
import { InteractionPatcher } from './InteractionPatcher.js';
import { CollectorService } from './CollectorService.js';
import { TimeoutComponent, TimeoutEmbed } from './PrebuiltEmbeds.js';
import { createComputed, createEffect, createSignal } from './Reactivity.js';
import { PatchTarget, PatchTargetBitMask } from './RenderingEngine.js';
import type { PropsBase } from './MenuView/ViewBase.js';
import { Navigation } from './Navigation.js';
import { asyncBoundary, setReactiveContext } from './ReactiveBuiltIns.js';
import type { TimeoutEndReason } from '../util/CollectorUtil.js';
import { batch } from '@preact/signals-core';
import type { DisposeFn } from './render/dispose.js';
import { getOpenOwner } from './render/owner.js';
import { NamedIdGenerator } from './ids/namedIdGenerator.js';
import { AutoComponentId } from './components/autoComponents.js';

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
  appendedComponents: MessageComponentBuilder[];
  prependedComponents: MessageComponentBuilder[];
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
  function routeComponentDisposalFn(id: string, disposal: DisposeFn): void {
    const openOwner = getOpenOwner();
    if (openOwner) {
      openOwner.registerComponentDisposal(id, disposal);
    } else {
      const existing = hangingComponentDisposals.get(id);
      existing?.();
      hangingComponentDisposals.set(id, disposal);
    }
  }

  function createSynapse(): Synapse {
    const $: Synapse = {
      ctx,
      appendEmbeds: (...embeds: EmbedBuilder[]) =>
        renderer.appendEmbeds(...embeds),
      prependEmbeds: (...embeds: EmbedBuilder[]) =>
        renderer.prependEmbeds(...embeds),
      appendComponents: (...components: MessageComponentBuilder[]) =>
        renderer.appendComponents(...components),
      prependComponents: (...components: MessageComponentBuilder[]) =>
        renderer.prependComponents(...components),
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
      component(definition) {
        const controller =
          'controller' in definition
            ? definition.controller
            : definition.handler;

        const componentId = createComponentId(
          definition.id ? definition.id : componentIdGenerator.next(),
        );

        definition.component.setCustomId(componentId);

        routeComponentDisposalFn(componentId, () => {
          collector.unsubscribeTo(componentId);
        });

        // Must come after in case it's an existing componentId.
        collector.onComponent(componentId, controller);

        return definition.component;
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
        const response = await asyncBoundary(() =>
          interaction.awaitModalSubmit(options).catch(() => {
            logger.info('Modal ended without receiving a response.');
            flushModal();
            return null;
          }),
        );
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
        const response = await asyncBoundary(() =>
          interaction.awaitModalSubmit(options).catch(() => {
            logger.info('Modal ended without receiving a response.');
            flushModal();
            return;
          }),
        );
        if (
          !response ||
          latestModal.interactionId !== interaction.id ||
          latestModal.customId !== response.customId
        ) {
          return;
        }

        flushModal();
        await batch(() => asyncBoundary(() => callback(response)));

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
        manualPatchQueued |= targets.reduce<PatchTargetBitMask>(
          (bitMask, target) => {
            return bitMask | target;
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
          registerEffect(() => void s.get(), patchTarget);
        }
        return s.split();
      },
      createWritableSignal<T>(
        initialValue: T | undefined = undefined,
        patchTarget = PatchTarget.None,
      ) {
        const s = createSignal(initialValue, patchTarget);
        if (patchTarget !== PatchTarget.None) {
          registerEffect(() => void s.get(), patchTarget);
        }
        return s;
      },
      createComputed: (fn) => createComputed(fn),
      createEffect: (fn, patchTarget) => registerEffect(fn, patchTarget),
      createEmbedEffect: (fn) => registerEffect(fn, PatchTarget.Embeds),
      createComponentEffect: (fn) => registerEffect(fn, PatchTarget.Components),
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
          reactivePayload.owner?.suspend();
          navigation.pushReactive(currentView, reactivePayload);
        } else {
          navigation.push(currentView);
        }
        renderer.queueViewSwapWithProps(
          view as View,
          props,
          /** skipCache= */ true,
        );
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
        payload.reactiveInstance?.owner?.resume();
        renderer.queueNavigation(payload);
      },
      canGoBack: () => {
        return !navigation.empty();
      },
      onResume(action) {
        const owner = getOpenOwner();
        if (!owner) {
          throw new Error('onResume must be called in a reactive context.');
        }
        owner.registerOnResume(action);
      },
      onSuspend(action) {
        const owner = getOpenOwner();
        if (!owner) {
          throw new Error('onSuspend must be called in a reactive context.');
        }
        owner.registerOnSuspend(action);
      },
      resumableSuspend: async (action) =>
        await action().then((r) => {
          setReactiveContext($);
          return r;
        }),
      getMenuInfo: () => ctx,
    };
    return $;
  }
  function registerEffect(
    fn: () => void | DisposeFn,
    patchTarget = PatchTarget.None,
  ): DisposeFn {
    function menuEffect(): void | DisposeFn {
      let dispose;
      const prevContext = setReactiveContext(builtins);
      try {
        dispose = fn();
      } finally {
        setReactiveContext(prevContext);
      }

      builtins.patch(patchTarget);
      return dispose;
    }

    const currentOwner = getOpenOwner();
    const dispose = createEffect(menuEffect);
    if (!currentOwner) {
      hangingDisposals.push(dispose);
    }
    return dispose;
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
    dispose();
  }
  function dispose() {
    logger.debug('Disposing MenuController');
    logger.debug(
      `Disposing ${hangingDisposals.length} hanging effect disposal(s)`,
    );
    for (const dispose of hangingDisposals) {
      dispose();
    }
    logger.debug(
      `Disposing ${hangingComponentDisposals.size} hanging component effect disposal(s)`,
    );
    hangingComponentDisposals.forEach((dispose) => dispose());
    renderer.dispose();
    return;
  }
  const hangingDisposals: DisposeFn[] = [];
  const hangingComponentDisposals = new Map<string, DisposeFn>();
  const ctx: MenuContext = {
    get interaction(): RepliableInteraction {
      return getInteractionToPatch();
    },
    initialInteraction: interaction,
    get idleTimeMs(): number {
      return idle;
    },
    menuId,
    initialViewId,
  };
  const builtins = createSynapse();
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
  const componentIdGenerator = new NamedIdGenerator('component');
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
  let manualPatchQueued: PatchTargetBitMask = 0;

  const [activeView, setActiveView] = builtins.createSignal<View | null>(null);
  if (shouldLog(LogLevel.Debug)) {
    createEffect(() => {
      logger.debug(`activeView set to --> ${activeView()?.id ?? null}`);
    });
  }

  function getPatchTargets(): PatchTargetBitMask {
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
      let patchTargets: PatchTargetBitMask = manualPatchQueued;
      if (renderer.hasQueuedEmbeds()) {
        patchTargets |= PatchTarget.Embeds;
      }
      if (renderer.hasQueuedNavigation()) {
        patchTargets |= PatchTarget.All;
      }
      logger.debug({ patchTargetBitMask: patchTargets });
      return patchTargets;
    }
    return PatchTarget.All;
  }

  function beforeRender() {
    const queued = renderer.getQueuedView();
    const queuedNav = renderer.getQueuedNavigation();
    if (queued) {
      logger.debug(':: about to set active view --> queued is not null');
      setActiveView(() => queued.view);
    } else if (queuedNav) {
      logger.debug(
        ':: about to set active view --> queuedNavigation is not null',
      );
      setActiveView(() => queuedNav.view);
    } else {
      logger.debug(
        ':: about to set active view --> queued was null, using current view',
      );
      setActiveView(() => assertNotNull(renderer.getCurrentView()));
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
    dispose();
    return patchTimeout();
  }

  function initCollector() {
    const { message } = patcher;
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

  async function handlePrebuiltComponents(
    collected: CollectedMessageInteraction,
  ) {
    const id = collected.customId;
    if (collected.isButton()) {
      switch (id as AutoComponentId) {
        case AutoComponentId.CloseMenuButton: {
          logger.debug('Closing Menu via official CloseMenuButton');
          await closeMenu();
          return true;
        }
      }
    }
    return false;
  }

  async function onCollect(collected: CollectedMessageInteraction) {
    if (await handlePrebuiltComponents(collected)) {
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

    const prevContext = setReactiveContext(builtins);
    try {
      await batch(async () => await interactionCallback(collected));
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
  async function update(patchTargets: PatchTargetBitMask): Promise<void> {
    beforeRender();
    try {
      const payload = await batch(
        async () => await renderer.patch(props, patchTargets),
      );
      await patcher.patch(payload, {});
    } finally {
      afterRender();
    }
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
    let target: PatchTarget;
    if (renderer.isCurrentViewV2()) {
      target = PatchTarget.Components;
      renderer.appendComponents(TimeoutComponent);
    } else {
      target = PatchTarget.Embeds | PatchTarget.Content;
      renderer.appendEmbeds(TimeoutEmbed);
      renderer.queueClear(PatchTarget.Components);
    }

    const payload = await renderer.patch(props, target);
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
): ClassViewProps<Props> & IntrinsicMenuProps {
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
