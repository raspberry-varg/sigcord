import { REACTIVE_VIEW_SYMBOL } from './reactiveViewSymbol.js';

import type { ReactiveViewInstance } from '../../menu/instance/instantiateReactiveView.js';
import type { ViewInstance } from '../view.js';

/** @internal */

export function isReactiveViewInstance(body: ViewInstance): body is ReactiveViewInstance {
  return REACTIVE_VIEW_SYMBOL in body;
}
