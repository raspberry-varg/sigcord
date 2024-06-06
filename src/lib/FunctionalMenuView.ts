/**
 * Functional implementation of Menu Views.
 */

import type { RepliableInteraction } from 'discord.js';
import type { Synapse } from './Synapse.js';
import { PropsBase, ViewDefinitionBase } from './MenuView/ViewBase.js';
import { ClassicViewClosureDefinition } from './MenuView/ClassicView.js';
import { ReactiveViewBody } from './MenuView/ReactiveView.js';
import { ClassicViewBody } from './MenuView/ClassicView.js';
import { ClassicViewInstance } from './MenuView/ClassicView.js';
import { ReactiveViewInstance } from './MenuView/ReactiveView.js';
import type { MaybePromise } from '../util/TypesUtil.js';

export type ViewDefinition<Props extends PropsBase = PropsBase> =
  ViewDefinitionBase & (ClassicViewBody<Props> | ReactiveViewBody);

export type View<Props extends PropsBase = PropsBase> =
  | ClassicViewClosureDefinition<Props>
  | ViewDefinition<Props>;

export type ViewInstance<Props extends PropsBase = PropsBase> =
  | ClassicViewInstance<Props>
  | ReactiveViewInstance;

export type ViewClosure<Props extends PropsBase = PropsBase> =
  | (() => ViewClosureReturn<Props>)
  | ((props: ViewProps<Props>) => ViewClosureReturn<Props>);

export type ViewClosureReturn<Props extends PropsBase = PropsBase> =
  MaybePromise<ClassicViewBody<Props> | ReactiveViewBody>;

export interface ViewClosureBody<Props extends PropsBase = PropsBase> {
  closure: ViewClosure<Props>;
}

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

export type ViewProps<
  Props extends NonNullable<unknown> = NonNullable<unknown>
> = Props & { $: Synapse };

export function DefineView<Props extends PropsBase = PropsBase>(
  id: string,
  definition: ViewClosure<Props> | ClassicViewBody<Props>
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
  definition: ViewClosure<Props> | ClassicViewBody<Props>
): View<Props> {
  const view = DefineView(id, definition);
  view.isSubView = true;
  return view;
}

/** @internal */
export async function instantiateViewFromClosure<
  Props extends PropsBase = PropsBase
>(
  view: ClassicViewClosureDefinition<Props>,
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
