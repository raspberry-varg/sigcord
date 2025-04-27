import { ViewProps, type View } from '../FunctionalMenuView.js';
import type { IntrinsicMenuProps } from '../InteractiveMenu.js';

import {
  IS_V2,
  type Children,
  type ReactiveViewPayload,
  type RenderedReactiveView,
} from '../MenuView.js';
import { createComputed, isSignal, isWritableSignal } from '../Reactivity.js';
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
  const factoryResult = view.factory(props);
  const isV2 = Array.isArray(factoryResult);
  const id = view.id;
  const instance: ReactiveViewInstance = isV2
    ? Object.assign(factoryResult, {
        [IS_REACTIVE_SYMBOL]: true,
        [IS_V2]: true,
        id,
      } as const)
    : ({
        [IS_REACTIVE_SYMBOL]: true,
        [IS_V2]: false,
        id: view.id,
        ...factoryResult,
      } as const);
  postProcessReactiveViewInstance(instance);
  return instance;
}

export function postProcessReactiveViewInstance(
  instance: ReactiveViewInstance,
): void {
  if (instance[IS_V2]) {
    // V2 is defined with a top-level array
    // TODO: @raspberry-varg - Maybe make the array optional, idk.
    return;
  }

  if (instance.embeds !== undefined) {
    instance.embeds = functionsAsComputed(instance.embeds);
  }
  if (instance.components !== undefined) {
    instance.components = functionsAsComputed(instance.components);
  }
}

function functionsAsComputed<T>(val: Children<T>): Children<T> {
  if (Array.isArray(val)) {
    return val.map(functionsAsComputed);
  }

  if (isWritableSignal(val)) {
    return val.readonly();
  }

  if (isSignal(val) || typeof val !== 'function') {
    return val;
  }

  return createComputed(() => val());
}
