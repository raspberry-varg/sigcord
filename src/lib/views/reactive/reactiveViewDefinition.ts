import type { IntrinsicMenuProps } from '../../InteractiveMenu.js';
import { IS_V2 } from '../../MenuView.js';
import { REACTIVE_VIEW_SYMBOL } from './reactiveViewSymbol.js';
import type { PropsBase } from '../../MenuView/ViewBase.js';
import type {
  ReactiveViewFactory,
  ReactiveViewFactoryV1,
  ReactiveViewFactoryV2,
} from './reactiveViewFactory.js';
import type { View } from '../view.js';

export type ReactiveViewBody<Props extends PropsBase = PropsBase> =
  ReactiveViewDefinition<Props>;

export type ReactiveViewDefinition<Props extends PropsBase = PropsBase> =
  | ReactiveViewDefinitionV1<Props>
  | ReactiveViewDefinitionV2<Props>;

interface ReactiveViewDefinitionBase<Props extends PropsBase> {
  readonly id: string;
  defaults: Partial<IntrinsicMenuProps>;
  factory: ReactiveViewFactory<Props>;
  [REACTIVE_VIEW_SYMBOL]: true;
}

export interface ReactiveViewDefinitionV1<Props extends PropsBase>
  extends ReactiveViewDefinitionBase<Props> {
  factory: ReactiveViewFactoryV1<Props>;
}

export interface ReactiveViewDefinitionV2<Props extends PropsBase>
  extends ReactiveViewDefinitionBase<Props> {
  [IS_V2]: true;
  factory: ReactiveViewFactoryV2<Props>;
}

export function isReactiveViewDefinition<Props extends PropsBase>(
  maybeView: View<Props>,
): maybeView is ReactiveViewDefinition<Props> {
  return REACTIVE_VIEW_SYMBOL in maybeView;
}

export function isReactiveViewDefinitionV2<Props extends PropsBase>(
  view: View<Props>,
): view is ReactiveViewDefinitionV2<Props> {
  return isReactiveViewDefinition(view) && IS_V2 in view;
}
