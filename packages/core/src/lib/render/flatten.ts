import type { ViewComponent } from '../views/viewFlavors.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import type { ReadonlyRecursive } from '../recursive.js';
import { ViewNode } from '../dom/viewNode.js';
import { setCurrentOwner, type Owner } from '../owners/owner.js';
import { ViewContentNode } from '../dom/viewContentNode.js';
import { ViewComputedElementNode } from '../dom/viewComputedElementNode.js';
import type { ViewNodeKindBase } from '../dom/viewNodeKind.js';
import { ViewManualComputedElementNode } from '../dom/viewManualComputedElementNode.js';

type ExcludeEmptyTypes<T> = NonNullable<Exclude<T, boolean>>;

export function flatten<T extends ViewNodeKindBase>(
  root: ViewNode<T> | ReadonlyArray<ViewNode<T>>,
  owner: Owner | null | undefined,
): Array<ExcludeEmptyTypes<T>> {
  const flattened: Array<ExcludeEmptyTypes<T>> = [];
  const stack: ReadonlyRecursive<ViewComponent | ViewNode<ViewComponent>>[] =
    Array.isArray(root) ? [...root] : [root];
  const prevOwner = setCurrentOwner(owner ?? null);
  try {
    while (stack.length) {
      const item = stack.pop();
      if (Array.isArray(item)) {
        stack.push(...item);
        continue;
      }
      if (item == null || (item as any) === false) {
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
