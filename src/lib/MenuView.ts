import {
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
  type ActionRowData,
  type MessageActionRowComponentData,
  type MessageComponentBuilder,
  type MessageFlags,
  type TopLevelComponent,
  type TopLevelComponentData,
} from 'discord.js';
import {
  PatchTarget,
  type WritableSignal,
  type Synapse,
  isWritableSignal,
} from '../index.js';
import type { IS_REACTIVE_SYMBOL } from './MenuView/ReactiveView.js';
import { isSignal, type Signalish } from './Reactivity.js';

export type ViewComponent =
  | TopLevelComponent
  | TopLevelComponentData
  | MessageComponentBuilder
  | ActionRowData<
      MessageActionRowComponentData | MessageActionRowComponentBuilder
    >;

export const IS_V2: unique symbol = Symbol('using v2 components');

export type RenderedReactiveView =
  | LegacyRenderedReactiveView
  | RenderedReactiveViewV2;

interface RenderedReactiveViewBase {
  readonly [IS_REACTIVE_SYMBOL]: true;
}

type LegacyRenderedReactiveView = LegacyReactiveViewPayload &
  RenderedReactiveViewBase & {
    [IS_V2]: false;
  };

type RenderedReactiveViewV2 = ReactiveViewPayloadV2 &
  RenderedReactiveViewBase & {
    [IS_V2]: true;
  };

export function isRenderedReactiveViewV2(
  view: RenderedReactiveView,
): view is RenderedReactiveViewV2 {
  return view[IS_V2];
}

export type ReactiveViewPayload =
  | ReactiveViewPayloadV2
  | LegacyReactiveViewPayload;

type ReactiveViewPayloadV2 = ReactiveViewPayloadV2Kind[];

type ReactiveViewPayloadV2Kind =
  | ReactiveViewPayloadV2Kind[]
  | AllowedTypes
  | Children<AllowedTypes>;

type AllowedTypes =
  | TopLevelComponentData
  | ActionRowData<
      MessageActionRowComponentData | MessageActionRowComponentBuilder
    >;

interface LegacyReactiveViewPayload {
  ephemeral?: boolean;
  content?: string | Signalish<string>;
  embeds?: EmbedChildren;
  components?: ComponentChildren;
}

export interface ViewMessagePayload {
  flags?: MessageFlags;
  /** @deprecated Use flags instead. */
  ephemeral?: boolean;
  content?: string;
  embeds?: EmbedBuilder[];
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

export type Children<T> =
  | Children<T>[]
  | (() => Children<T>)
  | WritableSignal<Children<T>>
  | T
  | false
  | null
  | undefined;

type EmbedChildren = Children<EmbedBuilder>;
type ComponentChildren = Children<ViewComponent>;

export function flattenChildren<T extends EmbedBuilder | ViewComponent>(
  $: Synapse,
  c: Children<T>,
  patchTarget: PatchTarget,
  out: T[] | undefined = undefined,
): T[] | undefined {
  if (c === null || c === undefined || c === false) {
    return out;
  }
  out ??= [];

  // resolve nested
  if (Array.isArray(c)) {
    for (const nested of c) {
      flattenChildren($, nested, patchTarget, out);
    }
  }
  // resolve writable signal
  else if (isWritableSignal(c)) {
    let initialVal;
    $.createEffect(() => {
      initialVal = c.get();
    }, patchTarget);
    flattenChildren($, initialVal, patchTarget, out);
  }
  // resolve a known signal
  else if (isSignal(c)) {
    let initialVal;
    $.createEffect(() => {
      initialVal = c();
    }, patchTarget);
    flattenChildren($, initialVal, patchTarget, out);
  }
  // resolve function call
  else if (typeof c === 'function') {
    const computed = $.createComputed(c);
    let initialVal;
    $.createEffect(() => {
      initialVal ??= computed();
    }, patchTarget);
    flattenChildren($, initialVal, patchTarget, out);
  } else if (c) {
    out.push(c);
  }
  return out;
}
