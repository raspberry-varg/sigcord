import { DeferredComponentViewNode } from '../dom/deferredComponentViewNode.js';
import { OwnerBoundaryViewNode } from '../dom/ownerBoundaryViewNode.js';
import { ViewComputedElementNode } from '../dom/viewComputedElementNode.js';
import { ViewContentNode } from '../dom/viewContentNode.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import { ViewManualComputedElementNode } from '../dom/viewManualComputedElementNode.js';
import { ViewNode } from '../dom/viewNode.js';
import { type Owner, runWithOwner, setCurrentOwner } from '../owners/owner.js';

import type { ViewNodeKindBase } from '../dom/viewNodeKind.js';
import type { ReadonlyRecursive } from '../recursive.js';
import type { ViewComponent } from '../views/viewFlavors.js';

type ExcludeEmptyTypes<T> = NonNullable<Exclude<T, boolean>>;

export function flatten<T extends ViewNodeKindBase>(
  root: ViewNode<T> | ReadonlyArray<ViewNode<T>>,
  owner: Owner | null,
): Array<ExcludeEmptyTypes<T>> {
  const flattened: Array<ExcludeEmptyTypes<T>> = [];
  const stack: ReadonlyRecursive<ViewComponent | ViewNode<ViewComponent>>[] = Array.isArray(root)
    ? [...root]
    : [root];
  const prevOwner = setCurrentOwner(owner);
  try {
    while (stack.length) {
      const item = stack.pop();
      if (item == null || (item as any) === false) {
        continue;
      }
      if (Array.isArray(item)) {
        stack.push(...item);
        continue;
      }
      if (item instanceof ViewContentNode) {
        const content = item.getContent();
        stack.push(content);
        continue;
      }
      if (item instanceof ViewManualComputedElementNode) {
        const content = item.getFlattened();
        stack.push(content);
        continue;
      }
      if (item instanceof ViewComputedElementNode) {
        const content = item.computer(flatten(item.children, owner));
        stack.push(content);
        continue;
      }
      if (item instanceof ViewElementNode) {
        stack.push(item.children);
        continue;
      }
      if (item instanceof OwnerBoundaryViewNode) {
        stack.push(flatten(item.children, item.owner) as any);
        continue;
      }
      if (item instanceof DeferredComponentViewNode) {
        stack.push(...runWithOwner(owner, () => item.execute()));
        continue;
      }
      if (item instanceof ViewNode) {
        // How did we get here?
        throw new Error(`Unhandled ViewNode: ${item}`);
      }
      flattened.push(item as (typeof flattened)[number]);
    }
  } finally {
    setCurrentOwner(prevOwner);
  }
  return flattened.toReversed();
}
