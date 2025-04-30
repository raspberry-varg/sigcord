import type { ReactiveViewInstance } from '../../MenuView/ReactiveView.js';
import type { ViewInstance } from '../view.js';
import { REACTIVE_VIEW_SYMBOL } from './reactiveViewSymbol.js';


/** @internal */

export function isReactiveViewInstance(
  body: ViewInstance
): body is ReactiveViewInstance {
  return REACTIVE_VIEW_SYMBOL in body;
}
