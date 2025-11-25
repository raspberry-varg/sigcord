import type { Primitive } from '../views/viewFlavors.js';
import { ViewNode } from './viewNode.js';
import type { BaseViewNodeKind } from './viewNodeKind.js';

export abstract class ViewManualComputedElementNode<
  T extends BaseViewNodeKind | Primitive,
> extends ViewNode<T> {
  /**
   * Get the flattened output of this computed element. This is called each time
   * this node is encountered in a call to `flatten`.
   */
  abstract getFlattened(): T | T[] | undefined;
}
