import { ViewContentNode } from '../dom/viewContentNode.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import { ViewNode } from '../dom/viewNode.js';
import type { ViewNodeKind } from '../dom/viewNodeKind.js';
import { patch } from '../ReactiveBuiltIns.js';
import {
  isSignal,
  isWritableSignal,
  createEffect,
  read,
} from '../Reactivity.js';
import type { Recursive } from '../recursive.js';
import { PatchTarget } from '../RenderingEngine.js';
import { isSlot } from '../Slot.js';
import { getOpenOwner } from './owner.js';

export function flattenToContentNodes<T extends ViewNodeKind>(
  content: Recursive<T | ViewNode<T>>,
): ViewNode<T>[] {
  if (Array.isArray(content)) {
    return content.flatMap(flattenToContentNodes);
  }

  if (content instanceof ViewNode) {
    return [content];
  }

  if (
    isSignal(content) ||
    isWritableSignal(content) ||
    typeof content === 'function'
  ) {
    const fragment = new ViewElementNode<T>();
    const dispose = createEffect(() => {
      patch(PatchTarget.Components);
      // TODO: @raspberry-varg - Reuse nodes.
      let value = read<T>(content);
      fragment.clear();
      fragment.addChild(...flattenToContentNodes<T>(value));
    });
    getOpenOwner()?.registerDisposal(dispose);
    return [fragment];
  }

  if (isSlot(content)) {
    // TODO: @raspberry-varg - Make the slot take care of this by reference. Make a new slot view node.
    const root = new ViewElementNode<T>();
    const dispose = createEffect(() => {
      patch(PatchTarget.Components);
      root.clear();
      const value = read<T[]>(content.signal as () => T[]);
      for (const el of value) {
        const node = new ViewElementNode();
        node.addChild(...flattenToContentNodes(el));
        root.addChild(node);
      }
    });
    getOpenOwner()?.registerDisposal(dispose);
    return [root];
  }

  return [new ViewContentNode(content)];
}
