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
import { type Signalish } from './Reactivity.js';
import { logger } from '../util/Logger.js';

export type ViewComponent = ActionRowBuilder<MessageActionRowComponentBuilder>;

export type RenderedReactiveView = ReactiveViewPayload & {
  readonly [IS_REACTIVE_SYMBOL]: true;
};

export interface ReactiveViewPayload {
  ephemeral?: boolean;
  content?: string | Signalish<string>;
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
  T extends MessageComponentInteraction = MessageComponentInteraction,
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
  // resolve function call
  else if (typeof c === 'function') {
    const computed = $.createComputed(c);
    let initialVal;
    logger.debug(`before effect; initialVal=${initialVal}`);
    $.createEffect(() => {
      initialVal ??= computed();
      logger.debug(`effect has been run; initialVal=${initialVal}`);
    }, patchTarget);
    logger.debug(`initialVal=${initialVal}`);
    flattenChildren($, initialVal, patchTarget, out);
  } else if (c) {
    out.push(c);
  }
  return out;
}
