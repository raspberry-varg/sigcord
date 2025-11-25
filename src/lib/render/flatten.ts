import type { Primitive, ViewComponent } from '../views/viewFlavors.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import type { ReadonlyRecursive } from '../recursive.js';
import { ViewNode } from '../dom/viewNode.js';
import { setCurrentOwner, type Owner } from './owner.js';
import { ViewContentNode } from '../dom/viewContentNode.js';
import { ViewComputedElementNode } from '../dom/viewComputedElementNode.js';
import type { BaseViewNodeKind } from '../dom/viewNodeKind.js';
import { ViewManualComputedElementNode } from '../dom/viewManualComputedElementNode.js';

export function flatten<T extends BaseViewNodeKind | Primitive>(
  root: ViewNode<T> | ReadonlyArray<ViewNode<T>>,
  owner: Owner | null | undefined,
): T[] {
  const flattened: T[] = [];
  const stack: ReadonlyRecursive<ViewComponent | ViewNode<ViewComponent>>[] =
    Array.isArray(root) ? [...root] : [root];
  const prevOwner = setCurrentOwner(owner ?? null);
  try {
    while (stack.length) {
      const item = stack.pop();
      if (Array.isArray(item)) {
        for (const inner of item) {
          stack.push(inner);
        }
        continue;
      }
      if (item instanceof ViewContentNode) {
        const content = item.getContent();
        if (content) {
          flattened.push(content);
        }
        continue;
      }
      if (item instanceof ViewManualComputedElementNode) {
        const content = item.getFlattened();
        if (content) {
          if (Array.isArray(content)) {
            flattened.push(...content);
          } else {
            flattened.push(content);
          }
        }
        continue;
      }
      if (item instanceof ViewComputedElementNode) {
        const content = item.computer(flatten(item.children, owner));
        if (content) {
          if (Array.isArray(content)) {
            flattened.push(...(content as T[]));
          } else {
            flattened.push(content as T);
          }
        }
        continue;
      }
      if (item instanceof ViewElementNode) {
        stack.push(item.children);
        continue;
      }
      if (item instanceof ViewNode) {
        // How did we get here?
        throw new Error(`Unhandled ViewNode: ${item}`);
      }
      if (item) {
        flattened.push(item as T);
      }
    }
  } finally {
    setCurrentOwner(prevOwner);
  }
  return flattened.toReversed();
}
