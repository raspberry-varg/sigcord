import { ViewNodeLegacy } from './viewNodeLegacy.js';

import type { ViewNodeKindBase } from './viewNodeKind.js';

export abstract class ViewManualComputedElementNode<
  T extends ViewNodeKindBase,
> extends ViewNodeLegacy<T> {
  /**
   * Get the flattened output of this computed element. This is called each time
   * this node is encountered in a call to `flatten`.
   */
  abstract getFlattened(): T | T[] | undefined;
}
