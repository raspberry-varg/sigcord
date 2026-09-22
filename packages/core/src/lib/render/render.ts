import { owner, useDisposeOwnerFn } from '../owners/owner.js';
import { untracked } from '../reactivity/untracked.js';
import { ViewElementNode } from '../vdom/viewElementNode.js';

import { flattenToContentNodes } from './flattenToContentNodes.js';

import type { Recursive } from '../recursive.js';
import type { ViewNodeKind, ViewNodeKindBase } from '../vdom/viewNodeKind.js';
import type { ViewNodeLegacy } from '../vdom/viewNodeLegacy.js';
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
): Array<ViewNodeLegacy<T>> {
  const content = untracked(renderFn) as Recursive<T>;
  return flattenToContentNodes(content);
}
