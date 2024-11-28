import type {
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
  EmbedBuilder,
  ModalBuilder,
  AwaitModalSubmitOptions,
  ModalSubmitInteraction,
  CommandInteraction,
} from 'discord.js';
import type { DefinedView, MenuContext, View } from './FunctionalMenuView.js';
import type { MessageComponentCallback } from './MenuView.js';
import type { ReactiveOptions, Signal, SignalTuple } from './Reactivity.js';
import type { PatchTarget } from './RenderingEngine.js';
import type { WritableSignal } from './Reactivity.js';
import type { PropsBase } from './MenuView/ViewBase.js';
import type { UnionToIntersection } from '../util/TypesUtil.js';

type ModalRepliableInteraction =
  | CommandInteraction
  | MessageComponentInteraction;

/**
 * Closure functions to manage and interact with a bound menu instance.
 *
 * The `Synapse` is a collection of closure functions bound to a menu instance.
 * These act as the central nervous system for your interactive menus.
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
    ComponentType extends MessageActionRowComponentBuilder,
    ComponentInteractionType extends MessageComponentInteraction
  >(definition: {
    id: string;
    component: ComponentType;
    controller: MessageComponentCallback<ComponentInteractionType>;
  }): ComponentType;
  swap(toViewId: string, ...args: any[]): void;
  swap<ViewDefinition extends View<P>, P extends PropsBase>(
    viewDefinition: ViewDefinition & View<P>,
    props: UnionToIntersection<P>
  ): void;
  appendEmbeds(...embeds: EmbedBuilder[]): void;
  prependEmbeds(...embeds: EmbedBuilder[]): void;
  showModal(
    interaction: ModalRepliableInteraction,
    modal: ModalBuilder
  ): Promise<void>;
  awaitModalSubmit(
    interaction: ModalRepliableInteraction,
    options: AwaitModalSubmitOptions<ModalSubmitInteraction>
  ): Promise<ModalSubmitInteraction<import('discord.js').CacheType> | null>;
  onModalSubmit(
    interaction: ModalRepliableInteraction,
    options: AwaitModalSubmitOptions<ModalSubmitInteraction>,
    callback: (collected: ModalSubmitInteraction) => unknown
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
  createSignal<T>(
    fnOrValue: undefined,
    params?: ReactiveOptions,
    patchTarget?: PatchTarget
  ): SignalTuple<T | undefined>;
  createSignal<T>(
    fnOrValue: T | (() => T),
    params?: ReactiveOptions,
    patchTarget?: PatchTarget
  ): SignalTuple<T>;

  createWritableSignal<T>(): WritableSignal<T | undefined>;
  createWritableSignal<T>(
    fnOrValue: undefined,
    params?: ReactiveOptions,
    patchTarget?: PatchTarget
  ): WritableSignal<T | undefined>;
  createWritableSignal<T>(
    fnOrValue: T | (() => T),
    params?: ReactiveOptions,
    patchTarget?: PatchTarget
  ): WritableSignal<T>;

  createEmbedSignal(
    closure: () => EmbedBuilder,
    params?: ReactiveOptions,
    patchTarget?: PatchTarget
  ): WritableSignal<EmbedBuilder>;
  createComponentSignal(
    closure: () => EmbedBuilder,
    params?: ReactiveOptions,
    patchTarget?: PatchTarget
  ): WritableSignal<EmbedBuilder>;

  createComputed<T>(
    fn: () => T,
    params?: ReactiveOptions,
    patchTarget?: PatchTarget
  ): Signal<T>;

  /**
   * Create an effect that runs when the value of signals in the function are
   * changed.
   *
   * **Note:** This does **not** queue a patch to the message content, embeds,
   * or components. To have a patch queued on effect run, use
   * {@link createEmbedEffect} or {@link createComponentEffect} instead. To
   * queue a patch for content, set content to a function that returns a string.
   * @param fn The effect to run.
   * @param params Extra configuration for debugging.
   * @param patchTarget Bitfield of {@link PatchTarget} to queue for rendering
   * when this effect runs.
   */
  createEffect: <T>(
    fn: () => T,
    params?: ReactiveOptions,
    patchTarget?: PatchTarget
  ) => void;
  /**
   * Create an effect that runs when the value of signals in the function are
   * changed.
   *
   * Automatically queues a patch to the menu's message embeds when the effect
   * is run.
   * @param fn The effect to run.
   * @param params Extra configuration for debugging.
   */
  createEmbedEffect: (fn: () => void, params?: ReactiveOptions) => void;
  /**
   * Create an effect that runs when the value of signals in the function are
   * changed.
   *
   * Automatically queues a patch to the menu's message components when the
   * effect is run.
   * @param fn The effect to run.
   * @param params Extra configuration for debugging.
   */
  createComponentEffect: (fn: () => void, params?: ReactiveOptions) => void;

  /**
   * Instantiate and navigate to a different view.
   *
   * - Can navigate back out of the view using {@link goBack}
   */
  goTo<
    ViewDef extends DefinedView<any>,
    Props extends ViewDef extends DefinedView<infer P> ? P : never
  >(
    view: ViewDef,
    props: Props
  ): void;

  /** @deprecated Not recommended. Not implemented. */
  goToCached<View extends DefinedView<any>>(
    view: View,
    props: View extends DefinedView<infer P> ? P : never
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

  /** The current menu controller's context. */
  ctx: MenuContext;
}
