import type {
  MessageActionRowComponentBuilder,
  EmbedBuilder,
  ModalBuilder,
  AwaitModalSubmitOptions,
  ModalSubmitInteraction,
} from 'discord.js';
import type { MenuContext } from './menuContext.js';
import type { DefinedView, View } from '../views/view.js';
import type { EffectFn, Signal, SignalTuple } from '../Reactivity.js';
import type { PatchTarget } from '../RenderingEngine.js';
import type { WritableSignal } from '../Reactivity.js';
import type { PropsBase } from '../MenuView/ViewBase.js';
import type { UnionToIntersection } from '../../util/TypesUtil.js';
import type { DisposeFn } from '../render/dispose.js';
import type {
  ModalRepliableInteraction,
  ModalHandlingOptions,
  ModalOnSubmitHandler,
} from '../interactivity/modalHandling.js';
import type { ComponentDefinition } from '../components/componentDefinition.js';

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
   * Create an effect that runs when the value of signals in the function are
   * changed.
   *
   * **Note:** This does **not** queue a patch to the message content, embeds,
   * or components. To have a patch queued on effect run, use
   * {@link createEmbedEffect} or {@link createComponentEffect} instead. To
   * queue a patch for content, set content to a function that returns a string.
   * @param fn The effect to run. Takes an optional cleanup fn.
   * @param params Extra configuration for debugging.
   * @param patchTarget Bit mask of {@link PatchTarget} to queue for rendering
   * when this effect runs.
   */
  createEffect: (fn: EffectFn, patchTarget?: PatchTarget) => DisposeFn;
  /**
   * Create an effect that runs when the value of signals in the function are
   * changed.
   *
   * Automatically queues a patch to the menu's message embeds when the effect
   * is run.
   * @param fn The effect to run.
   * @param params Extra configuration for debugging.
   */
  createEmbedEffect: (fn: EffectFn) => DisposeFn;
  /**
   * Create an effect that runs when the value of signals in the function are
   * changed.
   *
   * Automatically queues a patch to the menu's message components when the
   * effect is run.
   * @param fn The effect to run.
   * @param params Extra configuration for debugging.
   */
  createComponentEffect: (fn: EffectFn) => DisposeFn;

  /**
   * Instantiate and navigate to a different view.
   *
   * - Can navigate back out of the view using {@link goBack}
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

  resumableSuspend<R>(action: () => Promise<R>): Promise<R>;

  /** The current menu controller's context. */
  ctx: MenuContext;
}
