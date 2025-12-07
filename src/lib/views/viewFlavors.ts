import {
  type ContainerComponentBuilder,
  EmbedBuilder,
  type MessageComponentBuilder,
  MessageComponentInteraction,
  type MessageFlags,
  type StringSelectMenuOptionBuilder,
  type TopLevelComponent,
  type TopLevelComponentData,
} from 'discord.js';
import type { REACTIVE_VIEW_SYMBOL } from './reactive/reactiveViewSymbol.js';
import type { Signalish, WritableSignal } from '../reactivity/core/signals.js';
import type { ViewElementNode } from '../dom/viewElementNode.js';
import type { DisposeFn } from '../render/dispose.js';
import type { Owner } from '../render/owner.js';
import type { BaseViewNodeKind, ViewNodeKind } from '../dom/viewNodeKind.js';
import type { Slot } from '../Slot.js';
import type { ViewNode } from '../dom/viewNode.js';
import type { DeferredComponent } from '../render/deferredComponent.js';

export type EmbedComponent = EmbedBuilder;

export type ViewComponent = ViewComponentKind;

type ViewComponentKind =
  | TopLevelComponent
  | TopLevelComponentData
  | MessageComponentBuilder
  | ContainerComponentBuilder
  | StringSelectMenuOptionBuilder;

export const IS_V2: unique symbol = Symbol('using v2 components');

export type RenderedReactiveView =
  | RenderedReactiveViewV1
  | RenderedReactiveViewV2;

interface RenderedReactiveViewBase {
  readonly [REACTIVE_VIEW_SYMBOL]: true;
  dispose?: DisposeFn;
  owner?: Owner;
  lastRender?: ReactiveViewPayload;
  factory: () => ReactiveViewPayload;
}

interface RenderedReactiveViewV1 extends RenderedReactiveViewBase {
  roots?: {
    embeds?: ViewElementNode<EmbedComponent>;
    components?: ViewElementNode<ViewComponent>;
  };
  lastRender?: ReactiveViewPayloadV1;
  factory: () => ReactiveViewPayloadV1;
}

interface RenderedReactiveViewV2 extends RenderedReactiveViewBase {
  [IS_V2]: true;
  root?: ViewElementNode<ViewComponent>;
  owner?: Owner<ViewComponent>;
  lastRender?: ReactiveViewPayloadV2;
  factory: () => ReactiveViewPayloadV2;
}

export function isRenderedReactiveViewV2(
  view: RenderedReactiveView,
): view is RenderedReactiveViewV2 {
  return IS_V2 in view;
}

export type ReactiveViewPayload = ReactiveViewPayloadV1 | ReactiveViewPayloadV2;

export interface ReactiveViewPayloadV1 {
  ephemeral?: boolean;
  content?: string | Signalish<string>;
  embeds?: () => ViewNodeKind;
  components?: () => ViewNodeKind;
}

export type ReactiveViewPayloadV2 = ViewNodeKind;

export interface ViewMessagePayload {
  flags?: MessageFlags;
  /** @deprecated Use flags instead. */
  ephemeral?: boolean;
  content?: string;
  embeds?: EmbedComponent[];
  components?: ViewComponent[];
}

export interface MessageComponentCallback<
  T extends MessageComponentInteraction = MessageComponentInteraction,
> {
  (callback: T): Promise<unknown> | unknown;
}

export interface IntrinsicViewProps {
  /**
   * @deprecated Use {@link flags} instead
   */
  ephemeral: boolean | false;
  flags?: MessageFlags;
}

export type Primitive = string | number | boolean | null | undefined;

export type Children<T extends BaseViewNodeKind> =
  | Children<T>[]
  | (() => Children<T>)
  | DeferredComponent<Children<T>>
  | WritableSignal<Children<T>>
  | ViewNode<T>
  | Slot<T>
  | T[]
  | T
  | Primitive;
