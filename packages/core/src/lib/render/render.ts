import { owner, useDisposeOwnerFn } from '../owners/owner.js';
import { untracked } from '../reactivity/untracked.js';
import { ViewElementNode } from '../vdom/viewElementNode.js';

import type { Recursive } from '../recursive.js';
import type { ViewNodeKind, ViewNodeKindBase } from '../vdom/viewNodeKind.js';
import type { DisposeFn } from './dispose.js';

/**
 * @deprecated Replacement pending.
 * @param into
 * @param renderFn
 */
export function render<T extends ViewNodeKindBase>(
  into: ViewElementNode<T>,
  renderFn: () => ViewNodeKind<T>,
): DisposeFn {
  return owner(() => {
    into.setChildren(...renderFragment(renderFn));
    return useDisposeOwnerFn()!;
  });
}

/**
 * @deprecated Replacement pending.
 * @param renderFn
 */
export function renderFragment<T extends ViewNodeKindBase>(renderFn: () => ViewNodeKind<T>): any {
  return untracked(renderFn) as Recursive<T>;
}
