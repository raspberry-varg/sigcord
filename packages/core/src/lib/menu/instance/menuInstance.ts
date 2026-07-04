import {
  AwaitModalSubmitOptions,
  CollectedMessageInteraction,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  type RepliableInteraction,
} from 'discord.js';
import { type DefinedView, View } from '../../views/view.js';
import type { PropsBase } from '../../views/viewDefinitionBase.js';
import type { TimeoutEndReason } from '../../../util/CollectorUtil.js';
import type { Synapse } from './synapse.js';
import { Logger } from '../../../util/Logger.js';
import { ClassViewProps } from '../../FunctionalMenuView.js';
import type { IntrinsicMenuProps } from '../defineMenu.js';
import type { DisposeFn, ResumeFn, SuspendFn } from '../../render/dispose.js';
import {
  BufferedPatchStatus,
  InteractionPatcher,
} from './interactionPatcher.js';
import { CollectorService } from './collectorService.js';
import { Navigation } from '../../Navigation.js';
import { PatchTracker } from './patchTracker.js';
import { NamedIdGenerator } from '../../ids/namedIdGenerator.js';
import { ModalTracker } from './modalTracker.js';
import {
  PatchTarget,
  type PatchTargetBitMask,
  RenderingEngine,
} from '../../RenderingEngine.js';
import { Listener } from '../../../util/Listener.js';
import { microtaskQueuer, type MicrotaskQueuer } from './microtaskQueuer.js';
import { MenuContext } from './menuContext.js';
import { assert, assertAndReturn } from '../../../util/Assertions.js';
import type { ViewMessagePayload } from '../../views/viewFlavors.js';
import { batch } from '@preact/signals-core';
import { getOpenOwner } from '../../render/owner.js';
import { AutoComponentId } from '../../components/autocomponents.js';
import { TimeoutComponent, TimeoutEmbed } from '../../PrebuiltEmbeds.js';
import { getAsyncStore, setCurrentSynapse } from '../../builtins/builtins.js';
import { untracked } from '../../reactivity/untracked.js';
import { ComponentDefinition } from '../../components/componentDefinition.js';
import {
  ModalHandlingOptions,
  ModalOnSubmitHandler,
  ModalRepliableInteraction,
} from '../../interactivity/modalHandling.js';
import {
  createComputed,
  createEffect,
  createSignal,
  EffectFn,
  Signal,
  SignalTuple,
  WritableSignal,
} from '../../reactivity/core/signals.js';
import type { MenuInstanceActions } from './menuInstanceActions.js';

const DEFAULT_IDLE = 60_000;
const DefaultProperties: IntrinsicMenuProps = {
  renderAfterHandledInteraction: true,
  idleTimeMs: DEFAULT_IDLE,
  ephemeral: false,
};
const DefaultRenderOptions: RenderOptions = {
  forceReply: false,
} as const;

interface MenuControllerListeners {
  onRender: Listener<void>;
  onEnd: Listener<TimeoutEndReason | (string & {}) | null>;
  onStop: Listener<string | null>;
  onTimeout: Listener<TimeoutEndReason>;
}

export interface RenderOptions<ViewIds extends string = string> {
  /**
   * Reply or followup instead of editing or updating the original message.
   * @default false
   */
  forceReply: boolean | false;
  view?: ViewIds;
}

export class MenuInstance<
  ViewId extends string = string,
  AllProps extends PropsBase = PropsBase,
>
  implements Synapse, MenuInstanceActions
{
  private readonly logger = Logger.namespaced('MenuInstance');

  private readonly props: ClassViewProps & IntrinsicMenuProps;

  private readonly hangingDisposals: DisposeFn[] = [];
  private readonly hangingComponentDisposals = new Map<string, DisposeFn>();
  private readonly views: Map<string, View<AllProps>>;

  private readonly patcher: InteractionPatcher;
  private readonly collector: CollectorService;
  private readonly navigation: Navigation;
  private readonly patchTracker: PatchTracker;
  private readonly componentIdGenerator: NamedIdGenerator;

  private readonly modalTracker = new ModalTracker();
  private readonly renderer = new RenderingEngine();
  private readonly listeners: Readonly<MenuControllerListeners> = {
    onRender: new Listener(),
    onEnd: new Listener(),
    onStop: new Listener(),
    onTimeout: new Listener(),
  };

  private readonly updateMicrotask: MicrotaskQueuer;

  readonly ctx: MenuContext;

  private disposed = false;
  private idle: number;

  constructor(
    private readonly menuId: string,
    private readonly initialViewId: string,
    private readonly interaction: RepliableInteraction,
    initialProps: PropsBase,
    registeredViews: View<AllProps>[],
  ) {
    this.views = new Map(registeredViews.map((v) => [v.id, v]));
    this.props = buildProps(
      this,
      this.getView(initialViewId).defaults,
      initialProps,
    );

    this.patcher = new InteractionPatcher(interaction, this.props);

    this.collector = new CollectorService(this.listeners);
    this.navigation = new Navigation(this.collector);
    this.patchTracker = new PatchTracker(this.renderer, this.collector);
    this.componentIdGenerator = new NamedIdGenerator('component', menuId);

    this.idle =
      this.props.idleTimeMs === undefined
        ? DEFAULT_IDLE
        : assertAndReturn(
            this.props.idleTimeMs,
            (t) => t > 0,
            `Idle time must be greater than 0 milliseconds, got [${this.props.idleTimeMs}].`,
          );

    this.updateMicrotask = microtaskQueuer(this.doUpdateMicrotask.bind(this));

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const t = this;
    this.ctx = {
      get interaction(): RepliableInteraction {
        return t.getInteractionToPatch();
      },
      get lastCollectedInteraction() {
        return t.collector.lastCollected;
      },
      get activeInteraction(): RepliableInteraction {
        return t.patcher.interaction;
      },
      get isActivelyPatching(): boolean {
        return t.patcher.isPatching();
      },
      initialInteraction: interaction,
      get idleTimeMs(): number {
        return t.idle;
      },
      menuId,
      initialViewId,
    };
  }

  /*
   * Render API
   */

  async reply(options: Omit<Partial<RenderOptions<ViewId>>, 'forceReply'>) {
    return await this.start({ ...options, forceReply: true });
  }

  async start(options: Partial<RenderOptions> = {}) {
    options = { ...DefaultRenderOptions, ...options };
    await this.initialRender(options);
    this.initCollector();
  }

  /*
   * Listener API
   */

  onRender(callback: () => unknown, once = false): void {
    this.listeners.onRender.do(callback, once);
  }

  onEnd(
    callback: (endReason: TimeoutEndReason | (string & {}) | null) => unknown,
  ): void {
    this.listeners.onEnd.do(callback);
  }

  onStop(callback: (stopReason: string | null) => unknown): void {
    this.listeners.onStop.do(callback);
  }

  onTimeout(callback: (timeoutReason: TimeoutEndReason) => unknown): void {
    this.listeners.onTimeout.do(callback);
  }

  awaitRender() {
    return this.listeners.onRender.asPromise();
  }

  awaitEnd() {
    return this.listeners.onEnd.asPromise();
  }

  awaitStop() {
    return this.listeners.onStop.asPromise();
  }

  awaitTimeout() {
    return this.listeners.onTimeout.asPromise();
  }

  // ====================
  // << BEGIN INTERNAL >>
  // ====================

  // ==========================
  // Initial render and updates
  // ==========================

  private async doUpdateMicrotask(): Promise<void> {
    this.logger.info('Update microtask has run');
    if (this.disposed) {
      this.logger.info('...but the menu was disposed');
      return;
    }

    let payload: ViewMessagePayload | null = null;
    try {
      const targets = this.patchTracker.collectTargets();
      this.logger.debug('targets in render microtask ->', targets);
      payload = await this.render(targets);
    } catch (error: unknown) {
      this.logger.error('Error during update microtask', error);
      throw error;
    }

    if (this.disposed) {
      return;
    }

    if (payload) {
      await this.update(payload);
    } else {
      this.deferUpdate();
    }
  }

  private async update(payload: ViewMessagePayload): Promise<void> {
    try {
      const result = await this.patcher.patch(payload, {});
      switch (result) {
        case BufferedPatchStatus.Cancelled:
          this.logger.debug('Update cancelled');
          break;
        case BufferedPatchStatus.Completed:
          this.logger.debug('Update complete');
          break;
      }
    } catch (error: unknown) {
      this.logger.error('Error while patching update.', error);
      throw error;
    }
  }

  private async initialRender(options: Partial<RenderOptions>) {
    const initialView = this.getView(options.view ?? this.initialViewId);
    assert(
      !('isSubView' in initialView) || !initialView.isSubView,
      `Tried to render subview "${initialView.id}" directly. ` +
        'Subviews must be swapped into.',
    );
    this.renderer.queueViewSwap(initialView as View, []);
    this.patcher.mountInteraction(this.getInteractionToPatch());

    const payload = await this.render(null);
    if (payload) {
      try {
        const result = await this.patcher.patch(payload, {});
        switch (result) {
          case BufferedPatchStatus.Cancelled:
            this.logger.debug('Initial render cancelled');
            break;
          case BufferedPatchStatus.Completed:
            this.logger.debug('Initial render complete');
            break;
        }
      } catch (error: unknown) {
        this.logger.error('Error while patching initial render.', error);
        throw error;
      }
    }
  }

  private async render(
    patchTargets: PatchTargetBitMask | null,
  ): Promise<ViewMessagePayload | null> {
    if (patchTargets === 0) {
      return null;
    }

    let payload: ViewMessagePayload | Promise<ViewMessagePayload> | null = null;
    try {
      payload = batch(() =>
        patchTargets === null
          ? this.renderer.render(this.props)
          : this.renderer.patch(this.props, patchTargets),
      );
    } catch (error: unknown) {
      this.logger.error(
        `Error while creating a ${patchTargets === undefined ? 'payload' : 'patched payload'}`,
        error,
      );
      throw error;
    } finally {
      this.patchTracker.reset();
      this.listeners.onRender.fire();
    }

    if (payload instanceof Promise) {
      try {
        payload = await payload;
      } catch (error: unknown) {
        this.logger.error(
          'Error while resolving a promise returned from renderer',
          error,
        );
        payload = null;
        throw error;
      }
    }

    return payload;
  }

  private routeComponentDisposalFn(id: string, disposal: DisposeFn): void {
    const openOwner = getOpenOwner();
    if (openOwner) {
      openOwner.registerComponentDisposal(id, disposal);
    } else {
      const existing = this.hangingComponentDisposals.get(id);
      existing?.();
      this.hangingComponentDisposals.set(id, disposal);
    }
  }

  private createComponentId(componentId: string | null | undefined): string {
    return componentId || this.getNextUniqueComponentId();
  }

  private getView(id: string): View<AllProps> {
    const view = this.views.get(id);
    assert(view, `"${id}" is not a registered view.`);
    return view;
  }

  private getInteractionToPatch(): RepliableInteraction {
    return this.props.renderAfterHandledInteraction &&
      this.collector.lastCollected
      ? this.collector.lastCollected
      : this.interaction;
  }

  private clearViewArtifacts(): void {
    this.collector.clear();
    this.modalTracker.flush();
  }

  private dispose(): void {
    this.disposed = true;
    this.logger.verbose('Disposing menu instance', { menuId: this.menuId });
    this.logger.debug(
      `Disposing ${this.hangingDisposals.length} hanging effect disposal(s)`,
    );
    for (const dispose of this.hangingDisposals) {
      dispose();
    }
    this.logger.debug(
      `Disposing ${this.hangingComponentDisposals.size} hanging component effect disposal(s)`,
    );
    this.hangingComponentDisposals.forEach((dispose) => dispose());
    this.renderer.dispose();
  }

  private initCollector(): void {
    const { message } = this.patcher;
    assert(message, `Unable to initialize collectors; 'message' is undefined.`);
    this.collector.init({
      idle: this.idle,
      message,
      onTimeout: () => this.handleTimeout(),
      onCollect: (collected) => this.handleCollected(collected),
      filter: (i) =>
        i.user.id === this.interaction.user.id &&
        i.channelId === this.interaction.channelId,
    });
  }

  private async handlePrebuiltComponents(
    collected: CollectedMessageInteraction,
  ) {
    const id = collected.customId;
    if (collected.isButton()) {
      switch (id as AutoComponentId) {
        case AutoComponentId.CloseMenuButton: {
          this.logger.debug('Closing Menu via official CloseMenuButton');
          await this.close();
          return true;
        }
      }
    }
    return false;
  }

  private async handleTimeout(): Promise<void> {
    this.dispose();
    let target: PatchTarget;
    if (this.renderer.isCurrentViewV2()) {
      target = PatchTarget.Components;
      this.renderer.appendComponents(TimeoutComponent);
    } else {
      target = PatchTarget.Embeds | PatchTarget.Content;
      this.renderer.appendEmbeds(TimeoutEmbed);
      this.renderer.queueClear(PatchTarget.Components);
    }

    const payload = await this.renderer.patch(this.props, target);
    await this.patcher.patch(payload, {});
  }

  private async handleCollected(collected: CollectedMessageInteraction) {
    if (await this.handlePrebuiltComponents(collected)) {
      return;
    }

    if (this.props.renderAfterHandledInteraction) {
      this.patcher.mountInteraction(collected);
    }

    // route to registered handler
    const interactionCallback = this.collector.getComponentCallback(
      collected.customId,
    );

    if (!interactionCallback) {
      this.logger.warn(
        `MenuView: No handler defined for ${collected.customId}`,
      );
      return;
    }

    try {
      return void (await getAsyncStore().run(this, async () =>
        untracked(
          async () =>
            await batch(async () => await interactionCallback(collected)),
        ),
      ));
    } catch (e) {
      this.logger.error('Error during component interaction handle', {
        customId: collected.customId,
      });
      throw e;
    } finally {
      this.scheduleUpdate();
    }
  }

  // ==========
  // Public API
  // ==========

  appendEmbeds(...embeds: EmbedBuilder[]): void {
    this.renderer.appendEmbeds(...embeds);
  }

  prependEmbeds(...embeds: EmbedBuilder[]): void {
    this.renderer.prependEmbeds(...embeds);
  }

  appendComponents(...components: MessageComponentBuilder[]): void {
    this.renderer.appendComponents(...components);
  }

  prependComponents(...components: MessageComponentBuilder[]): void {
    this.renderer.prependComponents(...components);
  }

  swap(idOrView: string | View, ...args: unknown[] | [PropsBase]): void {
    this.clearViewArtifacts();

    const incomingIsView = typeof idOrView !== 'string';
    const view = incomingIsView ? idOrView : this.getView(idOrView);
    if (incomingIsView) {
      this.renderer.queueViewSwapWithProps(view as View, args[0] as PropsBase);
    } else {
      this.renderer.queueViewSwap(view as View, args);
    }
  }
  component<
    Builder extends MessageActionRowComponentBuilder,
    Cached extends boolean = boolean,
  >(definition: ComponentDefinition<Builder, Cached>): Builder {
    const componentId = this.createComponentId(
      definition.id || this.getNextUniqueComponentId(),
    );

    definition.component.setCustomId(componentId);

    this.routeComponentDisposalFn(componentId, () => {
      this.collector.unsubscribeTo(componentId);
    });

    // Must come after in case it's an existing componentId.
    this.collector.onComponent(componentId, definition.handler);

    return definition.component;
  }

  showModal(
    interaction: ModalRepliableInteraction,
    modal: ModalBuilder,
  ): Promise<void>;
  showModal(
    interaction: ModalRepliableInteraction,
    options: ModalHandlingOptions,
  ): Promise<void>;
  async showModal(
    interaction: ModalRepliableInteraction,
    modalOrOptions: ModalBuilder | ModalHandlingOptions,
  ): Promise<void> {
    let modal: ModalBuilder;
    let options: ModalHandlingOptions | undefined;
    if (modalOrOptions instanceof ModalBuilder) {
      modal = modalOrOptions;
    } else {
      modal = modalOrOptions.modal;
      options = modalOrOptions;
    }

    this.modalTracker.setModal(modal);
    this.patcher.showModal(interaction, modal);
    if (options) {
      await this.onModalSubmit(interaction, options, options.onSubmit);
    }
  }

  async awaitModalSubmit(
    interaction: ModalRepliableInteraction,
    options: AwaitModalSubmitOptions<ModalSubmitInteraction>,
  ): Promise<ModalSubmitInteraction<import('discord.js').CacheType> | null> {
    this.modalTracker.setInteraction(interaction);
    let response;
    try {
      response = await interaction.awaitModalSubmit(options);
    } catch (e) {
      this.logger.info('Modal ended without receiving a response.');
      this.logger.verbose(e);
      this.modalTracker.flush();
      return null;
    }
    if (
      !this.modalTracker.isInteractionId(interaction.id) ||
      !this.modalTracker.isCustomId(response.customId)
    ) {
      return null;
    }

    this.modalTracker.flush();
    void response.deferUpdate();

    return response;
  }

  async onModalSubmit(
    interaction: ModalRepliableInteraction,
    options: AwaitModalSubmitOptions<ModalSubmitInteraction>,
    callback: ModalOnSubmitHandler,
  ): Promise<void> {
    const response = await this.awaitModalSubmit(interaction, options);
    if (!response) {
      return;
    }

    const prevContext = setCurrentSynapse(this);
    let callbackResult;
    try {
      callbackResult = batch(() => callback(response));
    } catch (e) {
      this.logger.error('Error during onModalSubmit', {
        customId: response.customId,
      });
      throw e;
    } finally {
      setCurrentSynapse(prevContext);
      this.scheduleUpdate();
    }

    if (!(callbackResult instanceof Promise)) {
      return;
    }

    try {
      await callbackResult;
    } catch (error: unknown) {
      this.logger.error(`Error during onModalSubmit async callback resolve.`, {
        customId: response.customId,
      });
      throw error;
    } finally {
      this.scheduleUpdate();
    }
  }

  setIdleMs(idleMilliseconds: number): void {
    assert(
      idleMilliseconds > 0,
      `Idle time must be greater than 0 milliseconds, got [${idleMilliseconds}].`,
    );
    this.idle = idleMilliseconds;
    this.collector.updateIdle(this.idle);
  }

  setIdleSec(idleSeconds: number): void {
    assert(
      idleSeconds > 0,
      `Idle time must be greater than 0 seconds, got [${idleSeconds}].`,
    );
    this.setIdleMs(idleSeconds * 1_000);
  }

  async close(): Promise<void> {
    this.dispose();
    this.patcher.mountInteraction(this.interaction);
    await this.patcher.delete(this.props.initialMessage);
    this.collector.stop('close');
  }

  async stop(reason?: string): Promise<void> {
    this.deferUpdate();
    this.dispose();
    await this.patcher.stop();
    this.collector.stop(reason);
  }

  addPatchTargets(...targets: PatchTarget[]): void {
    for (const target of targets) {
      this.patchTracker.add(target);
    }
  }

  scheduleUpdate(): void {
    if (this.disposed) {
      this.logger.debug('Scheduled on a disposed object, ignoring');
      return;
    }
    this.updateMicrotask.set();
  }

  deferUpdate(interaction?: RepliableInteraction): void {
    const toDefer = interaction ?? this.collector.lastCollected;
    if (toDefer) {
      this.patcher.deferUpdate(toDefer);
    }
  }

  createSignal<T>(): SignalTuple<T | undefined>;
  createSignal<T>(initialValue: undefined): SignalTuple<T | undefined>;
  createSignal<T>(initialValue: T): SignalTuple<T>;
  createSignal<T>(
    fnOrValue: T | undefined = undefined,
    patchTarget = PatchTarget.None,
  ): SignalTuple<T | undefined> | SignalTuple<T> {
    const s = createSignal(fnOrValue, patchTarget);
    if (patchTarget !== PatchTarget.None) {
      this.createEffect(() => void s.get(), patchTarget);
    }
    return s.split();
  }

  createWritableSignal<T>(): WritableSignal<T | undefined>;
  createWritableSignal<T>(
    initialValue: undefined,
  ): WritableSignal<T | undefined>;
  createWritableSignal<T>(initialValue: T): WritableSignal<T>;
  createWritableSignal<T>(
    initialValue: T | undefined = undefined,
    patchTarget = PatchTarget.None,
  ): WritableSignal<T | undefined> | WritableSignal<T> {
    const s = createSignal(initialValue, patchTarget);
    if (patchTarget !== PatchTarget.None) {
      this.createEffect(() => void s.get(), patchTarget);
    }
    return s;
  }

  createComputed<T>(fn: () => T): Signal<T> {
    return createComputed(fn);
  }

  createEffect(
    fn: EffectFn,
    patchTarget: PatchTarget = PatchTarget.None,
  ): DisposeFn {
    const menuEffect = (): void | DisposeFn => {
      const dispose = getAsyncStore().run(this, fn);
      this.addPatchTargets(patchTarget);
      return dispose;
    };

    const currentOwner = getOpenOwner();
    const dispose = createEffect(menuEffect);
    if (!currentOwner) {
      this.hangingDisposals.push(dispose);
    }
    return dispose;
  }

  goTo<
    ViewDef extends DefinedView<any>,
    Props extends ViewDef extends DefinedView<infer P> ? P : never,
  >(view: ViewDef, props: Props): void {
    const currentView = this.renderer.getCurrentView();
    assert(
      currentView,
      'Tried to navigate before initial render in a reactive view.',
    );
    if (this.renderer.isCurrentViewReactive()) {
      const reactivePayload = this.renderer.getReactivePayload();
      assert(
        reactivePayload,
        'Tried to navigate before initial render in a reactive view.',
      );
      reactivePayload.owner?.suspend();
      this.navigation.push(currentView, reactivePayload);
    } else {
      this.navigation.push(currentView);
    }
    this.renderer.queueViewSwapWithProps(
      view as View,
      props,
      /** skipCache= */ true,
    );
  }

  goBack(): void {
    assert(
      !this.navigation.empty(),
      'Tried to navigate backwards without a parent view. Have you called goTo() in the parent view?',
    );
    const payload = this.navigation.pop();
    payload.reactiveInstance?.owner?.resume();
    this.renderer.queueNavigation(payload);
  }

  canGoBack(): boolean {
    return !this.navigation.empty();
  }

  onSuspend(action: SuspendFn): void {
    const owner = getOpenOwner();
    if (!owner) {
      throw new Error('onSuspend must be called in a reactive context.');
    }
    owner.registerOnSuspend(action);
  }

  onResume(action: ResumeFn): void {
    const owner = getOpenOwner();
    if (!owner) {
      throw new Error('onResume must be called in a reactive context.');
    }
    owner.registerOnResume(action);
  }

  getMenuInfo(): Readonly<MenuContext> {
    return this.ctx;
  }

  getNextUniqueComponentId(): string {
    return this.componentIdGenerator.next();
  }
}

function buildProps<AllProps extends PropsBase>(
  instance: MenuInstance<string, AllProps>,
  initProps: PropsBase,
  initialViewDefaults: PropsBase,
): ClassViewProps & IntrinsicMenuProps {
  return {
    ...DefaultProperties,
    ...initialViewDefaults,
    ...initProps,
    $: instance,
  };
}
