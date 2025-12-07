import { ViewContentNode } from '../dom/viewContentNode.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import { ViewNode } from '../dom/viewNode.js';
import type { ViewNodeKindBase, ViewNodeKind } from '../dom/viewNodeKind.js';
import { patchEffect } from '../builtins/builtins.js';
import {
  isStampedSignal,
  isWritableSignal,
} from '../reactivity/core/signals.js';
import type { Recursive } from '../recursive.js';
import { isSlot, SlotImpl } from '../Slot.js';
import { getOpenOwner } from './owner.js';
import { read } from '../reactivity/core/read.js';
import { DeferredComponent } from './deferredComponent.js';

export function flattenToContentNodes<T extends ViewNodeKind>(
  content: T,
): Array<ViewNode<T>> {
  if (Array.isArray(content)) {
    return content.flatMap(flattenToContentNodes);
  }

  if (content instanceof ViewNode) {
    return [content];
  }

  if (content instanceof DeferredComponent) {
    return flattenToContentNodes(content.execute());
  }

  if (isStampedSignal(content) || isWritableSignal(content)) {
    const fragment = new ViewElementNode<T>();
    const dispose = patchEffect(() => {
      // TODO: @raspberry-varg - Reuse nodes.
      const value = read<T>(content);
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
    return [(content as SlotImpl<ViewNodeKindBase>).node];
  }

  return [new ViewContentNode(content)];
}
