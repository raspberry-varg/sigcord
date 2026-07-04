import { ClassViewProps } from '../../FunctionalMenuView.js';
import { IS_V2, type RenderedReactiveView } from '../../views/viewFlavors.js';
import {
  isReactiveViewDefinitionV2,
  type ReactiveViewDefinition,
} from '../../views/reactive/reactiveViewDefinition.js';
import { REACTIVE_VIEW_SYMBOL } from '../../views/reactive/reactiveViewSymbol.js';
import type { PropsBase } from '../../views/viewDefinitionBase.js';

export type ReactiveViewInstance = {
  readonly id: string;
} & RenderedReactiveView;

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

  return {
    [REACTIVE_VIEW_SYMBOL]: true,
    id,
    roots: undefined,
    lastRender: undefined,
    factory: () => view.factory(props) as any,
  };
}
