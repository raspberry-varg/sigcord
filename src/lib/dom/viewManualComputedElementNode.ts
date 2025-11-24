import type { Primitive } from '../views/viewFlavors.js';
import { ViewNode } from './viewNode.js';
import type { BaseViewNodeKind } from './viewNodeKind.js';

export abstract class ViewManualComputedElementNode<
  T extends BaseViewNodeKind | Primitive,
> extends ViewNode<T> {
  abstract getComputed(): T | T[] | undefined;
}
