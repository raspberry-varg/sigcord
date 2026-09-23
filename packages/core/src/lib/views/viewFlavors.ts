import {
  type ContainerComponentBuilder,
  EmbedBuilder,
  type MessageComponentBuilder,
  MessageComponentInteraction,
  type MessageFlags,
  type SelectMenuComponentOptionData,
  type StringSelectMenuOptionBuilder,
  type TopLevelComponent,
  type TopLevelComponentData,
} from 'discord.js';

import type { Owner } from '../owners/owner.js';
import type { Signalish, WritableSignal } from '../reactivity/core/signals.js';
import type { DeferredComponentLegacy } from '../render/deferredComponent.js';
import type { DisposeFn } from '../render/dispose.js';
import type { Slot } from '../Slot.js';
import type { Primitive } from '../vdom/index.js';
import type { ViewNodeKind, ViewNodeKindBase } from '../vdom/viewNodeKind.js';
import type { ViewNodeLegacy } from '../vdom/viewNodeLegacy.js';
import type { REACTIVE_VIEW_SYMBOL } from './reactive/reactiveViewSymbol.js';

export type EmbedComponent = EmbedBuilder;

export type ViewComponent = ViewComponentKind;

type ViewComponentKind =
  | TopLevelComponent
  | TopLevelComponentData
  | MessageComponentBuilder
  | ContainerComponentBuilder
  | StringSelectMenuOptionBuilder
  | SelectMenuComponentOptionData;

export const IS_V2: unique symbol = Symbol('using v2 components');

export type RenderedReactiveView = RenderedReactiveViewV1 | RenderedReactiveViewV2;

interface RenderedReactiveViewBase {
  readonly [REACTIVE_VIEW_SYMBOL]: true;
  dispose?: DisposeFn;
  owner?: Owner;
  lastRender?: ReactiveViewPayload;
  factory: () => ReactiveViewPayload;
}

interface RenderedReactiveViewV1 extends RenderedReactiveViewBase {
  roots?: {
    embeds?: unknown[];
    components?: unknown[];
  };
  lastRender?: ReactiveViewPayloadV1;
  factory: () => ReactiveViewPayloadV1;
}

interface RenderedReactiveViewV2 extends RenderedReactiveViewBase {
  [IS_V2]: true;
  root?: unknown[];
  owner?: Owner;
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
  ephemeral?: boolean | false;
  flags?: MessageFlags;
}

export type Children<T extends ViewNodeKindBase> =
  | Children<T>[]
  | (() => Children<T>)
  | DeferredComponentLegacy<Children<T>>
  | WritableSignal<Children<T>>
  | ViewNodeLegacy<T>
  | Slot<T>
  | T[]
  | T
  | Primitive
  | Element;
