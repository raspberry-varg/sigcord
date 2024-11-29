import type { MaybePromise } from '../../util/TypesUtil.js';
import type { PropsBase } from './ViewBase.js';
import { ViewProps, type ClassViewDefinition } from '../FunctionalMenuView.js';
import type { ViewMessagePayload } from '../MenuView.js';
import type {
  ViewClass,
  ViewClassImplementation,
} from './DefineClassicView.js';

export type ViewRender<Props extends PropsBase = PropsBase> =
  | (() => MaybePromise<ViewMessagePayload>)
  | ((props: ViewProps<Props>) => MaybePromise<ViewMessagePayload>);

export interface ClassViewDefinitionBody<Props extends PropsBase = PropsBase> {
  class: ViewClassImplementation<Props>;
}

export type ClassicViewInstance<Props extends PropsBase> =
  ClassViewDefinition<Props> & {
    instance: ViewClass<Props>;
  };

/** @internal */
export function instantiateClassView<Props extends PropsBase>(
  view: ClassViewDefinition<Props>,
  props: ViewProps<Props>,
): ClassicViewInstance<Props> {
  return {
    ...view,
    instance: new view.class(props),
  };
}
