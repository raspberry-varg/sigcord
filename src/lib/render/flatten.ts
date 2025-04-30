import type { EmbedComponent, ViewComponent } from '../MenuView.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import type { Recursive } from '../recursive.js';
import { ViewNode } from '../dom/viewNode.js';
import { setCurrentOwner, type Owner } from './owner.js';
import { ViewContentNode } from '../dom/viewContentNode.js';

export function flatten<T extends EmbedComponent | ViewComponent>(
  root: ViewElementNode<T>,
  owner: Owner | null | undefined,
): T[] {
  const flattened: T[] = [];
  const stack: Recursive<ViewComponent | ViewNode<ViewComponent>>[] = [root];
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
      if (item instanceof ViewElementNode) {
        stack.push(item.children as ViewNode<any>[]);
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
