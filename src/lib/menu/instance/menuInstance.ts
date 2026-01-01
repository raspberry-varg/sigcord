import {
  type CollectedMessageInteraction,
  type EmbedBuilder,
  type MessageComponentBuilder,
  ModalBuilder,
  type RepliableInteraction,
} from 'discord.js';
import { Synapse } from './synapse.js';
import { type ModalHandlingOptions } from '../../interactivity/modalHandling.js';
import { ClassViewProps } from '../../FunctionalMenuView.js';
import { type MenuContextWithInternal } from './menuContext.js';
import { View } from '../../views/view.js';
import { IntrinsicMenuProps } from '../defineMenu.js';
import { assert, assertAndReturn } from '../../../util/Assertions.js';
import { Listener } from '../../../util/Listener.js';
import { Logger } from '../../../util/Logger.js';
import {
  PatchTarget,
  PatchTargetBitMask,
  RenderingEngine,
} from '../../RenderingEngine.js';
import {
  BufferedPatchStatus,
  InteractionPatcher,
} from './interactionPatcher.js';
import { CollectorService } from './collectorService.js';
import { TimeoutComponent, TimeoutEmbed } from '../../PrebuiltEmbeds.js';
import {
  createComputed,
  createEffect,
  createSignal,
} from '../../reactivity/core/signals.js';
import type { PropsBase } from '../../views/viewDefinitionBase.js';
import { Navigation } from '../../Navigation.js';
import { getAsyncStore, setReactiveContext } from '../../builtins/builtins.js';
import type { TimeoutEndReason } from '../../../util/CollectorUtil.js';
import { batch } from '@preact/signals-core';
import type { DisposeFn } from '../../render/dispose.js';
import { getOpenOwner } from '../../render/owner.js';
import { NamedIdGenerator } from '../../ids/namedIdGenerator.js';
import { AutoComponentId } from '../../components/autocomponents.js';
import type { ViewMessagePayload } from '../../views/viewFlavors.js';
import { INTERNAL_CONTEXT_SYMBOL } from './internalMenuContext.js';
import { untracked } from '../../reactivity/untracked.js';
import { MenuInstance } from './classBasedInstance.js';

export interface MenuControllerAPI {
  // render API
  start(options?: Partial<RenderOptions>): Promise<void>;
  reply(
    options: Omit<Partial<RenderOptions<string>>, 'forceReply'>,
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

export function instantiateMenu<
  ViewId extends string = string,
  AllProps extends PropsBase = PropsBase,
>(
  menuId: string,
  initialViewId: string,
  registeredViews: View<AllProps>[],
  interaction: RepliableInteraction,
  initProps: NonNullable<unknown>,
): MenuControllerAPI {
  return new MenuInstance<ViewId, AllProps>(
    menuId,
    initialViewId,
    interaction,
    initProps,
    registeredViews,
  );
}

export function instantiateMenuLegacy<
  ViewId extends string = string,
  AllProps extends PropsBase = PropsBase,
>(
  menuId: string,
  initialViewId: string,
  registeredViews: View<AllProps>[],
  interaction: RepliableInteraction,
  initProps: NonNullable<unknown>,
): MenuControllerAPI {
  const logger = Logger.namespaced('MenuInstance');

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
        const componentId = createComponentId(
          definition.id ? definition.id : componentIdGenerator.next(),
        );

        definition.component.setCustomId(componentId);

        routeComponentDisposalFn(componentId, () => {
          collector.unsubscribeTo(componentId);
        });

        // Must come after in case it's an existing componentId.
        collector.onComponent(componentId, definition.handler);

        return definition.component;
      },
      showModal: async (interaction, modalOrOptions) => {
        let modal: ModalBuilder;
        let options: ModalHandlingOptions | undefined;
        if (modalOrOptions instanceof ModalBuilder) {
          modal = modalOrOptions;
        } else {
          modal = modalOrOptions.modal;
          options = modalOrOptions;
        }

        latestModal.customId = modal.data.custom_id ?? '';
        patcher.showModal(interaction, modal);
        if (options) {
          await $.onModalSubmit(interaction, options, options.onSubmit);
        }
      },
      awaitModalSubmit: async (interaction, options) => {
        latestModal.interactionId = interaction.id;
        const response = await interaction
          .awaitModalSubmit(options)
          .catch(() => {
            logger.info('Modal ended without receiving a response.');
            flushModal();
            return;
          });
        if (
          !response ||
          latestModal.interactionId !== interaction.id ||
          latestModal.customId !== response.customId
        ) {
          return null;
        }

        void response.deferUpdate();

        flushModal();
        return response;
      },
      onModalSubmit: async (interaction, options, callback) => {
        const response = await $.awaitModalSubmit(interaction, options);
        if (!response) {
          return;
        }

        const prevContext = setReactiveContext(builtins);
        let callbackResult;
        try {
          callbackResult = batch(() => callback(response));
        } catch (e) {
          logger.error('Error during onModalSubmit', {
            customId: response.customId,
          });
          throw e;
        } finally {
          setReactiveContext(prevContext);
          builtins.scheduleUpdate();
        }

        if (!(callbackResult instanceof Promise)) {
          return;
        }

        try {
          await callbackResult;
        } catch (error: unknown) {
          logger.error(`Error during onModalSubmit async callback resolve.`, {
            customId: response.customId,
          });
          throw error;
        } finally {
          builtins.scheduleUpdate();
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
      stop: (reason?: string) => {
        void stopMenu(reason);
      },
      /**
       * Manually schedule an update to the current view in a microtask.
       *
       * Note: Updates are automatically scheduled after initial render and after interaction
       * handlers resolve.
       */
      scheduleUpdate: () => {
        if (disposed) {
          logger.debug('Scheduled on a disposed object, ignoring');
          return;
        }
        maybeQueueUpdate();
      },
      addPatchTargets: (...targets) => {
        for (const target of targets) {
          manualPatchQueued |= target;
        }
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
          navigation.push(currentView, reactivePayload);
        } else {
          navigation.push(currentView);
        }
        renderer.queueViewSwapWithProps(
          view as View,
          props,
          /** skipCache= */ true,
        );
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
      getMenuInfo: () => ctx,
      deferUpdate(interaction) {
        const toDefer = interaction ?? collector.lastCollected;
        if (toDefer) {
          patcher.deferUpdate(toDefer);
        }
      },
      getNextUniqueComponentId: () => componentIdGenerator.next(),
    };
    return $;
  }
  function registerEffect(
    fn: () => void | DisposeFn,
    patchTarget = PatchTarget.None,
  ): DisposeFn {
    function menuEffect(): void | DisposeFn {
      const dispose = getAsyncStore().run(builtins, fn);
      builtins.addPatchTargets(patchTarget);
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

  let updateMicrotaskQueued = false;
  function maybeQueueUpdate() {
    if (!updateMicrotaskQueued) {
      updateMicrotaskQueued = true;
      logger.info('Queueing update microtask');
      queueMicrotask(async () => {
        updateMicrotaskQueued = false;
        logger.info('Update microtask has run');
        if (disposed) {
          logger.info('...but the menu was disposed');
          return;
        }

        let payload: ViewMessagePayload | null = null;
        try {
          const targets = getPatchTargets();
          logger.debug('targets in render microtask ->', targets);
          payload = await render(targets);
        } catch (error: unknown) {
          logger.error('Error during update microtask', error);
          throw error;
        }

        if (disposed) {
          return;
        }

        if (payload) {
          await update(payload);
        } else {
          builtins.deferUpdate();
        }
      });
    }
  }

  let disposed = false;
  function dispose() {
    disposed = true;
    logger.verbose('Disposing menu instance', { menuId });
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
  const ctx: MenuContextWithInternal = {
    get interaction(): RepliableInteraction {
      return getInteractionToPatch();
    },
    get lastCollectedInteraction() {
      return collector.lastCollected;
    },
    get activeInteraction(): RepliableInteraction {
      return patcher.interaction;
    },
    get isActivelyPatching(): boolean {
      return patcher.isPatching();
    },
    initialInteraction: interaction,
    get idleTimeMs(): number {
      return idle;
    },
    menuId,
    initialViewId,
    [INTERNAL_CONTEXT_SYMBOL]: {},
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
  const componentIdGenerator = new NamedIdGenerator('component', menuId);
  let idle: number =
    props.idleTimeMs === undefined
      ? DEFAULT_IDLE
      : assertAndReturn(
          props.idleTimeMs,
          (t) => t > 0,
          `Idle time must be greater than 0 milliseconds, got [${props.idleTimeMs}].`,
        );
  const collector = new CollectorService(listeners);
  const navigation = new Navigation(collector);
  const latestModal = {
    interactionId: '',
    customId: '',
  };
  let manualPatchQueued: PatchTargetBitMask = 0;

  function getPatchTargets(): PatchTargetBitMask {
    logger.debug({
      collectorEnded: collector.hasEnded(),
      collectorInitialized: collector.isInitialized(),
      isCurrentViewReactive: renderer.isCurrentViewReactive(),
      rendererHasQueuedView: renderer.hasQueuedView(),
      manualPatchQueued,
    });
    if (collector.hasEnded()) {
      return PatchTarget.None;
    }
    // do not wait for a dirty signal graph to render a queued view
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

  function createComponentId(
    componentId: string | null | undefined,
  ): MenuViewComponentId {
    return componentId || componentIdGenerator.next();
  }

  function clearViewArtifacts() {
    collector.clear();
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
    tearDownMenu();
    patcher.mountInteraction(interaction);
    await patcher.delete(props.initialMessage);
    collector.stop('close');
  }

  async function stopMenu(reason?: string) {
    builtins.deferUpdate();
    tearDownMenu();
    await patcher.stop();
    collector.stop(reason);
  }

  function tearDownMenu() {
    dispose();
  }

  function getComponentId(rawCustomId: string) {
    return rawCustomId;
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

    try {
      return void (await getAsyncStore().run(builtins, async () =>
        untracked(
          async () =>
            await batch(async () => await interactionCallback(collected)),
        ),
      ));
    } catch (e) {
      logger.error('Error during component interaction handle', {
        customId: collected.customId,
      });
      throw e;
    } finally {
      builtins.scheduleUpdate();
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

    const payload = await render(null);
    if (payload) {
      try {
        const result = await patcher.patch(payload, {});
        switch (result) {
          case BufferedPatchStatus.Cancelled:
            logger.debug('Initial render cancelled');
            break;
          case BufferedPatchStatus.Completed:
            logger.debug('Initial render complete');
            break;
        }
      } catch (error: unknown) {
        logger.error('Error while patching initial render.', error);
        throw error;
      }
    }
  }

  /** Handles subsequent rerenders. */
  async function update(payload: ViewMessagePayload): Promise<void> {
    try {
      const result = await patcher.patch(payload, {});
      switch (result) {
        case BufferedPatchStatus.Cancelled:
          logger.debug('Update cancelled');
          break;
        case BufferedPatchStatus.Completed:
          logger.debug('Update complete');
          break;
      }
    } catch (error: unknown) {
      logger.error('Error while patching update.', error);
      throw error;
    }
  }

  async function render(
    patchTargets: PatchTargetBitMask | null,
  ): Promise<ViewMessagePayload | null> {
    if (patchTargets === 0) {
      return null;
    }

    let payload: ViewMessagePayload | Promise<ViewMessagePayload> | null = null;
    try {
      payload = batch(() =>
        patchTargets === null
          ? renderer.render(props)
          : renderer.patch(props, patchTargets),
      );
    } catch (error: unknown) {
      logger.error(
        `Error while creating a ${patchTargets === undefined ? 'payload' : 'patched payload'}`,
        error,
      );
      throw error;
    } finally {
      manualPatchQueued = 0;
      listeners.onRender.fire();
    }

    if (payload instanceof Promise) {
      try {
        payload = await payload;
      } catch (error: unknown) {
        logger.error(
          'Error while resolving a promise returned from renderer',
          error,
        );
        payload = null;
        throw error;
      }
    }

    return payload;
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
