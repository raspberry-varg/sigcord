import { ViewElementNode } from '../dom/viewElementNode.js';
import { owner, useDisposeOwnerFn } from '../owners/owner.js';
import { untracked } from '../reactivity/untracked.js';

import { flattenToContentNodes } from './flattenToContentNodes.js';

import type { ViewNode } from '../dom/viewNode.js';
import type { ViewNodeKind, ViewNodeKindBase } from '../dom/viewNodeKind.js';
import type { Recursive } from '../recursive.js';
import type { DisposeFn } from './dispose.js';

export function render<T extends ViewNodeKindBase>(
  into: ViewElementNode<T>,
  renderFn: () => ViewNodeKind<T>,
): DisposeFn {
  return owner(() => {
    into.setChildren(...renderFragment(renderFn));
    return useDisposeOwnerFn()!;
  });
}

export function renderFragment<T extends ViewNodeKindBase>(
  renderFn: () => ViewNodeKind<T>,
): Array<ViewNode<T>> {
  const content = untracked(renderFn) as Recursive<T>;
  return flattenToContentNodes(content);
}
