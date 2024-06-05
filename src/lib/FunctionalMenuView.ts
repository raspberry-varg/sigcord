/**
 * Functional implementation of Menu Views.
 */

import type {
  AwaitModalSubmitOptions,
  CommandInteraction,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  RepliableInteraction,
} from 'discord.js';
import type { Reactive, ReactivelyParams } from '@reactively/core';
import type { MessageComponentCallback, ReactiveViewPayload, ViewPayload } from './MenuView.js';
import { MaybePromise } from '../util/TypesUtil.js';

type PropsBase = NonNullable<unknown>;
type ModalRepliableInteraction =
  | CommandInteraction
  | MessageComponentInteraction;

interface ViewDefinitionBase {
  readonly id: string;
  /** If true, this view cannot be an initial view and must be swapped into. */
  isSubView?: boolean;
  onSwap?: (...args: any[]) => MaybePromise<void>;
}

type ViewClosureReturn<Props extends PropsBase = PropsBase> = MaybePromise<
  ViewBody<Props> | ReactiveViewBody
>;

interface ViewClosureBody<Props extends PropsBase = PropsBase> {
  closure: ViewClosure<Props>;
}

export type ViewClosureDefinition<Props extends PropsBase = PropsBase> =
  ViewDefinitionBase & ViewClosureBody<Props>;

export type ViewClosure<Props extends PropsBase = PropsBase> =
  | (() => ViewClosureReturn<Props>)
  | ((props: ViewProps<Props>) => ViewClosureReturn<Props>);

export type ReactiveView<Props extends PropsBase> =
  | (() => ReactiveViewPayload)
  | ((props: ViewProps<Props>) => ReactiveViewPayload);

export type ReactiveViewBody = ReactiveViewPayload;

export interface ViewBody<Props extends PropsBase = PropsBase> {
  /** Callback when this view is {@link Synapse.swap swapped} into. */
  render: ViewRender<Props>;
}

export type ViewDefinition<Props extends PropsBase = PropsBase> =
  ViewDefinitionBase & (ViewBody<Props> | ReactiveViewBody);

export type View<Props extends PropsBase = PropsBase> =
  | ViewClosureDefinition<Props>
  | ViewDefinition<Props>;

export type ViewRender<Props extends PropsBase = PropsBase> =
  | (() => MaybePromise<ViewPayload>)
  | ((props: ViewProps<Props>) => MaybePromise<ViewPayload>);

export type ViewInstance<Props extends PropsBase = PropsBase> =
  | ClassicViewInstance<Props>
  | ReactiveViewInstance;

export type ClassicViewInstance<Props extends PropsBase> = ViewDefinitionBase &
  ViewBody<Props>;

export type ReactiveViewInstance = ViewDefinitionBase & ReactiveViewBody;

export interface MenuContext {
  /**
   * The latest interaction this menu is bound to.
   *
   * Note: If `props.renderAfterHandledInteraction` is set to `true`,
   *       this is the latest collected interaction (i.e. a component interaction).
   */
  interaction: RepliableInteraction;
  /**
   * The reaction provided when initializing this menu.
   *
   * Useful if `props.renderAfterHandledInteraction` is set to `true`.
   */
  readonly initialInteraction: RepliableInteraction;
  /**
   * The current menu idle time in milliseconds.
   */
  get idleTimeMs(): number;
}

/**
 * Closure functions to manage and interact with a bound menu instance.
 *
 * The `Synapse` is a collection of closure functions bound to a menu instance.
 * These act as the central nervous system for your interactive menus.
 */
export interface Synapse {
  /**
   * Configures a reactive message component.
   *
   * - Passed component id is auto-formatted to `menuId:viewId:componentId`.
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
  createSignal: <T>(
    fnOrValue: T | (() => T),
    params?: ReactivelyParams
  ) => Reactive<T>;
  createEffect: <T>(
    fn: () => T,
    params?: Omit<ReactivelyParams, 'effect'>
  ) => void;
  ctx: MenuContext;
}

export type ViewProps<
  Props extends NonNullable<unknown> = NonNullable<unknown>
> = Props & { $: Synapse };

export function DefineView<Props extends PropsBase = PropsBase>(
  id: string,
  definition: ViewClosure<Props> | ViewBody<Props>
): View<Props> {
  return {
    ...(typeof definition === 'function'
      ? { closure: definition }
      : definition),
    id,
  };
}

/**
 * Define a view that can only be swapped into.
 * Cannot be used as an initial view.
 */
export function DefineSubView<Props extends PropsBase = PropsBase>(
  id: string,
  definition: ViewClosure<Props> | ViewBody<Props>
): View<Props> {
  const view = DefineView(id, definition);
  view.isSubView = true;
  return view;
}

/** @internal */
export async function instantiateViewFromClosure<
  Props extends PropsBase = PropsBase
>(
  view: ViewClosureDefinition<Props>,
  props: ViewProps<Props>
): Promise<ViewInstance<Props>> {
  const body = await view.closure(props);
  return {
    ...body,
    id: view.id,
  };
}

/** @internal */
export function isReactiveViewInstance<Props extends PropsBase>(
  body: ViewInstance<Props>
): body is ReactiveViewInstance {
  return !('render' in body);
}
