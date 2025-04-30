import { ClassViewProps } from '../FunctionalMenuView.js';
import { type View } from '../views/view.js';

import { IS_V2, type RenderedReactiveView } from '../MenuView.js';
import {
  isReactiveViewDefinitionV2,
  type ReactiveViewDefinition,
} from '../views/reactive/reactiveViewDefinition.js';
import { REACTIVE_VIEW_SYMBOL } from '../views/reactive/reactiveViewSymbol.js';
import type { PropsBase } from './ViewBase.js';

export type ReactiveViewInstance = {
  readonly id: string;
} & RenderedReactiveView;

export function isReactiveView(view: View): view is ReactiveViewDefinition {
  return REACTIVE_VIEW_SYMBOL in view;
}

/** @internal */
export function instantiateReactiveView<Props extends PropsBase = PropsBase>(
  view: ReactiveViewDefinition<Props>,
  props: ClassViewProps<Props>,
): ReactiveViewInstance {
  const id = view.id;
  const isV2 = isReactiveViewDefinitionV2(view);
  if (isV2) {
    const instance: ReactiveViewInstance = {
      [REACTIVE_VIEW_SYMBOL]: true,
      [IS_V2]: true,
      id,
      root: undefined,
      lastRender: undefined,
      factory: () => view.factory(props) as any,
    };
    return instance;
  }
  const instance: ReactiveViewInstance = {
    [REACTIVE_VIEW_SYMBOL]: true,
    id,
    roots: undefined,
    lastRender: undefined,
    factory: () => view.factory(props) as any,
  };
  return instance;
}
