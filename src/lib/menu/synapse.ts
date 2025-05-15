import type {
  MessageActionRowComponentBuilder,
  EmbedBuilder,
  ModalBuilder,
  AwaitModalSubmitOptions,
  ModalSubmitInteraction,
  MessageComponentBuilder,
} from 'discord.js';
import type { MenuContext } from './menuContext.js';
import type { DefinedView, View } from '../views/view.js';
import type { EffectFn, Signal, SignalTuple } from '../Reactivity.js';
import type { PatchTarget } from '../RenderingEngine.js';
import type { WritableSignal } from '../Reactivity.js';
import type { PropsBase } from '../MenuView/ViewBase.js';
import type { UnionToIntersection } from '../../util/TypesUtil.js';
import type { DisposeFn, ResumeFn, SuspendFn } from '../render/dispose.js';
import type {
  ModalRepliableInteraction,
  ModalHandlingOptions,
  ModalOnSubmitHandler,
} from '../interactivity/modalHandling.js';
import type { ComponentDefinition } from '../components/componentDefinition.js';
import type { effect, patchEffect } from '../ReactiveBuiltIns.js';
import type { ReactiveViewPayloadV1 } from '../MenuView.js';

/**
 * Closure functions to manage and interact with a bound menu instance.
 *
 * The `Synapse` is a collection of closure functions bound to a menu instance.
 * These act as the central nervous system for your interactive menus.
 *
 * Prefer reactive hooks over using the Synapse directly for reactive menus.
 */
export interface Synapse {
  /**
   * Configures an interactive message component.
   *
   * - Passed component id is auto-formatted to `menuId:viewId:componentId`.
   *   - `viewId:viewId:componentId` if standalone.
   * - Calls the passed component builder's `setCustomId` with the provided id.
   * - Binds a given handler to a component via its id.
   * @returns The provided component builder.
   */
  component<
    Builder extends MessageActionRowComponentBuilder,
    Cached extends boolean = boolean,
  >(
    definition: ComponentDefinition<Builder, Cached>,
  ): Builder;
  swap(toViewId: string, ...args: any[]): void;
  swap<ViewDefinition extends View<P>, P extends PropsBase>(
    viewDefinition: ViewDefinition & View<P>,
    props: UnionToIntersection<P>,
  ): void;
  appendEmbeds(...embeds: EmbedBuilder[]): void;
  prependEmbeds(...embeds: EmbedBuilder[]): void;
  appendComponents(...components: MessageComponentBuilder[]): void;
  prependComponents(...components: MessageComponentBuilder[]): void;
  showModal(
    interaction: ModalRepliableInteraction,
    modal: ModalBuilder,
  ): Promise<void>;
  showModal(
    interaction: ModalRepliableInteraction,
    options: ModalHandlingOptions,
  ): Promise<void>;
  awaitModalSubmit(
    interaction: ModalRepliableInteraction,
    options: AwaitModalSubmitOptions<ModalSubmitInteraction>,
  ): Promise<ModalSubmitInteraction<import('discord.js').CacheType> | null>;
  onModalSubmit(
    interaction: ModalRepliableInteraction,
    options: AwaitModalSubmitOptions<ModalSubmitInteraction>,
    callback: ModalOnSubmitHandler,
  ): Promise<void>;
  setIdleMs(idleMilliseconds: number): void;
  setIdleSec(idleSeconds: number): void;
  close: () => Promise<void>;
  stop: (reason?: string) => void;
  queueRender: () => void;
  skipRender: () => void;
  /**
   * In reactive views, manually queue patches for specific pieces the message
   * instead of relying on reactivity.
   */
  patch: (...targets: PatchTarget[]) => void;
  doUpdate: () => Promise<void>;

  createSignal<T>(): SignalTuple<T | undefined>;
  createSignal<T>(initialValue: undefined): SignalTuple<T | undefined>;
  createSignal<T>(initialValue: T): SignalTuple<T>;

  createWritableSignal<T>(): WritableSignal<T | undefined>;
  createWritableSignal<T>(
    initialValue: undefined,
  ): WritableSignal<T | undefined>;
  createWritableSignal<T>(initialValue: T): WritableSignal<T>;

  createComputed<T>(fn: () => T): Signal<T>;

  /**
   * @deprecated Use the {@link patchEffect()} hook instead.
   *
   * @summary Create an effect that runs when signals referenced in the effect
   * function change.
   *
   * @param fn The effect to run.
   * @param patchTarget {@link PatchTarget} bit mask to queue for rendering.
   *   Useful when mutating content objects like component or embed builders to
   *   have the change reflected to the user.   */
  createEffect: (fn: EffectFn, patchTarget?: PatchTarget) => DisposeFn;

  /**
   * @deprecated
   * Effect context is now dynamically-tracked as a component is rendered and
   * re-rendered. Please use {@link patchEffect} instead to have updates to embed
   * objects automatically reflected to the user.
   *
   * Components V1: If you must set up effects that mutate embed objects outside
   * of the call to {@link ReactiveViewPayloadV1.embeds}, please pass
   * {@link PatchTarget.Embeds} to the optional second parameter in
   * {@link effect}.
   *
   * @summary
   * Create an effect that runs when the value of signals in the function are
   * changed.
   *
   * Automatically queues a patch to the menu's message embeds when the effect
   * is run.
   * @param fn The effect to run.
   * @param params Extra configuration for debugging.   */
  createEmbedEffect: (fn: EffectFn) => DisposeFn;

  /**
   * @deprecated
   * Effect context is now dynamically-tracked as a component is rendered and
   * re-rendered. Please use {@link patchEffect} instead to have updates to
   * component objects automatically reflected to the user.
   *
   * Components V1: If you must set up effects that mutate embed objects outside
   * of the call to {@link ReactiveViewPayloadV1.components}, please pass
   * {@link PatchTarget.Components} to the optional second parameter in
   * {@link effect}.
   *
   * @summary
   * Create an effect that runs when the value of signals in the function are
   * changed.
   *
   * Automatically queues a patch to the menu's message components when the
   * effect is run.
   * @param fn The effect to run.
   * @param params Extra configuration for debugging.   */
  createComponentEffect: (fn: EffectFn) => DisposeFn;

  /**
   * Instantiate and navigate to a different view. The current view will be
   * suspended, but signals and effects will be unaffected.
   *
   * **Note:** Take extra care to not let state leak in any direction of the
   *   current navigation stack. Use {@link onNavigate()} and {@link onResume()}
   *   to properly manage state based on navigation.
   *
   * @example
   * ```
   * import {OtherView} from './otherView';
   * import {NavigateButton} from './navigateButton';
   *
   * function MyView = defineView<MyViewProps>(() => {
   *   const button = component({
   *     button: NavigateButton,
   *     onClick: () => goTo(OtherView, {/* *\/})
   *   });
   * });
   * ```
   * fefe
   * wefwf
   *
   * @see {@link goBack()} for navigating back.
   * @see {@link canGoBack()} for checking if
   * @see {@link onResume()} for configuring behavior when the view is navigated
   *   back to.
   * @see {@link onSuspend()} for configuring suspension behavior.
   */
  goTo<
    ViewDef extends DefinedView<any>,
    Props extends ViewDef extends DefinedView<infer P> ? P : never,
  >(
    view: ViewDef,
    props: Props,
  ): void;

  /** @deprecated Not recommended. Not implemented. */
  goToCached<View extends DefinedView<any>>(
    view: View,
    props: View extends DefinedView<infer P> ? P : never,
  ): void;

  /**
   * Navigate back to the calling view.
   *
   * @throws If not navigated to using {@link goTo}
   */
  goBack(): void;

  /**
   * Returns true if this view was navigated to using {@link goTo}. Safely allows
   * the use of {@link goBack} since the previous menu is on the navigation stack.
   */
  canGoBack(): boolean;

  /**
   * Perform an action when this reactive view is navigated away from.
   *
   * @param action Action to perform when this view suspends.
   */
  onSuspend(action: SuspendFn): void;

  /**
   * Perform an action when this reactive view is navigated back to.
   *
   * @param action Action to perform when this menu is navigated back to.
   */
  onResume(action: ResumeFn): void;

  resumableSuspend<R>(action: () => Promise<R>): Promise<R>;

  getMenuInfo(): Readonly<MenuContext>;

  /**
   * @deprecated Property will be removed soon. Please use {@link getMenuInfo()}
   *   or its reactive hook.
   *
   * @summary The current menu controller's context.
   */
  ctx: MenuContext;
}
