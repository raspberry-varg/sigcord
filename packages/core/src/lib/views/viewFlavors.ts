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
import type { Signalish } from '../reactivity/core/signals.js';
import type { DisposeFn } from '../render/dispose.js';
import type { REACTIVE_VIEW_SYMBOL } from './reactive/reactiveViewSymbol.js';

/**
 * @deprecated Please move to Cords instead.
 */
export type EmbedComponent = EmbedBuilder;

/**
 * @deprecated Please move to Cords instead.
 */
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
    embeds?: {
      vdom: unknown[];
      owner: Owner;
    };
    components?: {
      vdom: unknown[];
      owner: Owner;
    };
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

/**
 * @deprecated Please move to Cords instead.
 */
export type ReactiveViewPayload = ReactiveViewPayloadV1 | ReactiveViewPayloadV2;

/**
 * @deprecated Please move to Cords instead.
 */
export interface ReactiveViewPayloadV1 {
  ephemeral?: boolean;
  content?: string | Signalish<string>;
  embeds?: () => unknown;
  components?: () => unknown;
}

export type ReactiveViewPayloadV2 = unknown;

/**
 * @deprecated Please move to Cords instead.
 */
export interface ViewMessagePayload {
  flags?: MessageFlags;
  /** @deprecated Use flags instead. */
  ephemeral?: boolean;
  content?: string;
  embeds?: EmbedComponent[];
  components?: ViewComponent[];
}

/**
 * @deprecated Please move to Cords instead.
 */
export interface MessageComponentCallback<
  T extends MessageComponentInteraction = MessageComponentInteraction,
> {
  (callback: T): Promise<unknown> | unknown;
}
