import type {
  ClassViewDefinition,
  ClassViewProps,
} from '../../FunctionalMenuView.js';
import type { ViewClass } from '../../MenuView/DefineClassicView.js';
import type { PropsBase } from '../../MenuView/ViewBase.js';
import type { ViewInstance } from '../view.js';

/** @internal */
export function isClassViewInstance(
  body: ViewInstance,
): body is ClassicViewInstance<PropsBase> {
  return 'instance' in body;
}

/** @internal */
export function instantiateClassView<Props extends PropsBase = PropsBase>(
  view: ClassViewDefinition<Props>,
  props: ClassViewProps<Props>,
): ClassicViewInstance<Props> {
  return {
    id: view.id,
    defaults: {},
    class: view.class,
    instance: new view.class(props),
  };
}
export type ClassicViewInstance<Props extends PropsBase> =
  ClassViewDefinition<Props> & {
    instance: ViewClass<Props>;
  };
