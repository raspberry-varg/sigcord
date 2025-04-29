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
import type { IS_REACTIVE_SYMBOL } from './MenuView/ReactiveView.js';
import {
  isSignal,
  isWritableSignal,
  type WritableSignal,
  type Signalish,
} from './Reactivity.js';
import type { Synapse } from './Synapse.js';
import type { PatchTarget } from './RenderingEngine.js';
import {
  SLOT_ENQUEUE_FLUSH_METHOD,
  Slot,
  isSlot,
  type SlotImpl,
} from './Slot.js';
import { logger } from '../util/Logger.js';
import type { ViewElementNode } from './dom/viewElementNode.js';
import type { DisposeFn } from './render/dispose.js';
import { ViewNode } from './dom/viewNode.js';
import type { Owner } from './render/owner.js';

export type ViewComponent = ViewComponentKind;

type ViewComponentKind =
  | Slot<ViewComponentKind>
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

interface RenderedReactiveViewV2 extends RenderedReactiveViewBase {
  [IS_V2]: true;
  root?: ViewElementNode<ViewComponent>;
  dispose?: DisposeFn;
  owner?: Owner<ViewComponent>;
  lastRender?: ReactiveViewPayloadV2;
  factory: () => ReactiveViewPayloadV2;
}

export function isRenderedReactiveViewV2(
  view: RenderedReactiveView,
): view is RenderedReactiveViewV2 {
  return view[IS_V2];
}

export type ReactiveViewPayload = ReactiveViewPayloadV2;
// | LegacyReactiveViewPayload;

type ReactiveViewPayloadV2 = Children<ViewComponent | ViewNode<ViewComponent>>;

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
    let initialVal: ReturnType<typeof c> | undefined;
    $.createEffect(() => {
      if (!initialVal) logger.debug(`creating effect for signal=${c}`);
      initialVal = c();
      return () => {
        logger.debug(`signal disposed: ${c}`);
      };
    }, patchTarget);
    flattenChildren($, initialVal, patchTarget, out);
  }
  // resolve function call
  else if (typeof c === 'function') {
    const computed = $.createComputed(c);
    let initialVal;
    $.createEffect(() => {
      if (!initialVal!) logger.debug(`creating effect for fn=${computed}`);
      initialVal = computed();
      return () => {
        logger.debug(`fn disposed: ${computed}`);
      };
    }, patchTarget);
    flattenChildren($, initialVal, patchTarget, out);
  } else if (isSlot(c)) {
    const impl = c as SlotImpl<ViewComponent>;
    let initialVal;
    $.createEffect(() => {
      initialVal = impl.signal();
      impl[SLOT_ENQUEUE_FLUSH_METHOD]();
    }, patchTarget);
    flattenChildren($, initialVal, patchTarget, out);
  } else if (c) {
    out.push(c);
  }
  return out;
}
