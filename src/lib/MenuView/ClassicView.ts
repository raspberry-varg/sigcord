import type { MaybePromise } from '../../util/TypesUtil.js';
import type { PropsBase, ViewDefinitionBase } from './ViewBase.js';
import { ViewProps } from '../FunctionalMenuView.js';
import type { ViewPayload } from '../MenuView.js';
import { ViewClosureBody } from '../FunctionalMenuView.js';

export type ViewRender<Props extends PropsBase = PropsBase> =
  | (() => MaybePromise<ViewPayload>)
  | ((props: ViewProps<Props>) => MaybePromise<ViewPayload>);

export interface ClassicViewBody<Props extends PropsBase = PropsBase> {
  /** Callback when this view is {@link Synapse.swap swapped} into. */
  render: ViewRender<Props>;
}

export type ClassicViewClosureDefinition<Props extends PropsBase = PropsBase> =
  ViewDefinitionBase & ViewClosureBody<Props>;

export type ClassicViewInstance<Props extends PropsBase> = ViewDefinitionBase &
  ClassicViewBody<Props>;
