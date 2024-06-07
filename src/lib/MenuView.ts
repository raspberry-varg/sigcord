import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
} from 'discord.js';
import type { Signal, Synapse } from '../index.js';
import { Reactive } from '@reactively/core';

export type ViewComponent = ActionRowBuilder<MessageActionRowComponentBuilder>;

export type RenderedReactiveViewPayload = ReactiveViewPayload;

export interface ReactiveViewPayload {
  ephemeral?: boolean;
  content?: string | Signal<string> | (() => string);
  embeds?: EmbedChildren;
  components?: ComponentChildren;
}

export interface ViewPayload {
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
  | Signal<Children<T>>
  | T
  | null
  | undefined;

type EmbedChildren = Children<EmbedBuilder>;
type ComponentChildren = Children<ViewComponent>;

export function flattenChildren<T extends EmbedBuilder | ViewComponent>(
  $: Synapse,
  c: Children<T>,
  out: T[] | undefined = undefined
): T[] | undefined {
  if (c === null || c === undefined) {
    return out;
  }
  out ??= [];

  // resolve nested
  if (Array.isArray(c)) {
    for (const nested of c) {
      flattenChildren($, nested, out);
    }
  }
  // resolve signal
  else if (c instanceof Reactive) {
    flattenChildren($, c.get(), out);
  }
  // resolve function call
  else if (typeof c === 'function') {
    // wrap fn in a signal hooked to the current patch ctx
    c = $.createSignal(c, {});
    flattenChildren($, c.get(), out);
  } else {
    out.push(c);
  }
  return out;
}
