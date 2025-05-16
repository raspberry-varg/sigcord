import { ViewContentNode } from '../dom/viewContentNode.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import { ViewNode } from '../dom/viewNode.js';
import type { ViewNodeKind } from '../dom/viewNodeKind.js';
import { patchEffect } from '../ReactiveBuiltIns.js';
import { isSignal, isWritableSignal, read } from '../Reactivity.js';
import type { Recursive } from '../recursive.js';
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

  if (isSignal(content) || isWritableSignal(content)) {
    const fragment = new ViewElementNode<T>();
    const dispose = patchEffect(() => {
      // TODO: @raspberry-varg - Reuse nodes.
      let value = read<T>(content);
      fragment.addChild(...flattenToContentNodes<T>(value));
      return () => {
        fragment.clear();
      };
    });
    getOpenOwner()?.registerDisposal(dispose);
    return [fragment];
  }

  if (typeof content === 'function') {
    return flattenToContentNodes(
      (content as () => Recursive<T | ViewNode<T>>)(),
    );
  }

  if (isSlot(content)) {
    return [content.root];
  }

  return [new ViewContentNode(content)];
}
