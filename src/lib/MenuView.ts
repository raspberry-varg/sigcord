import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
} from 'discord.js';
import {
  PatchTarget,
  type WritableSignal,
  type Synapse,
  isWritableSignal,
} from '../index.js';
import type { IS_REACTIVE_SYMBOL } from './MenuView/ReactiveView.js';

export type ViewComponent = ActionRowBuilder<MessageActionRowComponentBuilder>;

export type RenderedReactiveView = ReactiveViewPayload & {
  readonly [IS_REACTIVE_SYMBOL]: true;
};

export interface ReactiveViewPayload {
  ephemeral?: boolean;
  content?: string | WritableSignal<string> | (() => string);
  embeds?: EmbedChildren;
  components?: ComponentChildren;
}

export interface ViewMessagePayload {
  ephemeral?: boolean;
  content?: string;
  embeds?: EmbedBuilder[];
  components?: ViewComponent[];
}

export interface MessageComponentCallback<
  T extends MessageComponentInteraction = MessageComponentInteraction
> {
  (callback: T): Promise<unknown> | unknown;
}

export interface IntrinsicViewProps {
  ephemeral: boolean | false;
}

type Children<T> =
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
  out: T[] | undefined = undefined
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
    const patchTargetAware = $.createComputed(c.get, {}, patchTarget);
    flattenChildren($, patchTargetAware(), patchTarget, out);
  }
  // resolve function call
  else if (typeof c === 'function') {
    const patchTargetAware = $.createComputed(c, {}, patchTarget);
    flattenChildren($, patchTargetAware(), patchTarget, out);
  } else if (c) {
    out.push(c);
  }
  return out;
}
