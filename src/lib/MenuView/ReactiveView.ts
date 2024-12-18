import { ViewProps, type View } from '../FunctionalMenuView.js';
import type { IntrinsicMenuProps } from '../InteractiveMenu.js';

import type { ReactiveViewPayload, RenderedReactiveView } from '../MenuView.js';
import type { PropsBase } from './ViewBase.js';

export type ReactiveViewFactory<Props extends PropsBase> = (
  props: ViewProps<Props>,
) => ReactiveViewPayload;

export type ReactiveViewBody<Props extends PropsBase = PropsBase> =
  ReactiveViewDefinition<Props>;

export interface ReactiveViewDefinition<Props extends PropsBase = PropsBase> {
  readonly id: string;
  defaults: Partial<IntrinsicMenuProps>;
  factory: ReactiveViewFactory<Props>;
  [IS_REACTIVE_SYMBOL]: true;
}

export type ReactiveViewInstance = {
  readonly id: string;
} & RenderedReactiveView;

export const IS_REACTIVE_SYMBOL = Symbol('is_reactive');

export function isReactiveViewDefinition(
  maybeView: View,
): maybeView is ReactiveViewDefinition {
  return IS_REACTIVE_SYMBOL in maybeView;
}

export function isReactiveView(view: View): view is ReactiveViewDefinition {
  return IS_REACTIVE_SYMBOL in view;
}

/** @internal */
export function instantiateReactiveView<Props extends PropsBase = PropsBase>(
  view: ReactiveViewDefinition<Props>,
  props: ViewProps<Props>,
): ReactiveViewInstance {
  return {
    ...view.factory(props),
    id: view.id,
    [IS_REACTIVE_SYMBOL]: true,
  };
}
