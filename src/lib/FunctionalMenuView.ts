/**
 * Functional implementation of Menu Views.
 */

import type { RepliableInteraction } from 'discord.js';
import type { Synapse } from './Synapse.js';
import { PropsBase, type ViewDefinitionBase } from './MenuView/ViewBase.js';
import {
  IS_REACTIVE_SYMBOL,
  type ReactiveViewDefinition,
} from './MenuView/ReactiveView.js';
import { ClassViewDefinitionBody } from './MenuView/ClassicView.js';
import { ClassicViewInstance } from './MenuView/ClassicView.js';
import { ReactiveViewInstance } from './MenuView/ReactiveView.js';
import type { MenuFactory } from './InteractiveMenu.js';

export type ClassViewDefinition<Props extends PropsBase = PropsBase> =
  ViewDefinitionBase & ClassViewDefinitionBody<Props>;

export type DefinedView<Props extends PropsBase = PropsBase> =
  MenuFactory<Props> & View<Props>;

export type View<Props extends PropsBase = PropsBase> =
  | ClassViewDefinition<Props>
  | ReactiveViewDefinition<Props>;

export type ViewInstance =
  | ClassicViewInstance<PropsBase>
  | ReactiveViewInstance;

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

export type ViewProps<Props extends PropsBase = PropsBase> = Props & {
  $: Synapse;
};

/** @internal */
export async function instantiateClassView<Props extends PropsBase = PropsBase>(
  view: ClassViewDefinition<Props>,
  props: ViewProps<Props>
): Promise<ClassicViewInstance<Props>> {
  return {
    id: view.id,
    defaults: {},
    class: view.class,
    instance: new view.class(props),
  };
}

/** @internal */
export function isReactiveViewInstance(
  body: ViewInstance
): body is ReactiveViewInstance {
  return IS_REACTIVE_SYMBOL in body;
}

/** @internal */
export function isClassViewInstance(
  body: ViewInstance
): body is ClassicViewInstance<PropsBase> {
  return 'instance' in body;
}
