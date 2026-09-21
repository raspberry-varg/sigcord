import { effect, markDirty } from '../../framework/hooks/index.js';
import { DeferredComponentViewNode } from '../dom/deferredComponentViewNode.js';
import { ViewContentNode } from '../dom/viewContentNode.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import { ViewNode } from '../dom/viewNode.js';
import { read } from '../reactivity/core/read.js';
import { isStampedSignal, isWritableSignal } from '../reactivity/core/signals.js';
import { isSlot, SlotImpl } from '../Slot.js';

import { DeferredComponent } from './deferredComponent.js';

import type { ViewNodeKind, ViewNodeKindBase } from '../dom/viewNodeKind.js';
import type { Recursive } from '../recursive.js';

export function flattenToContentNodes<T extends ViewNodeKind>(content: T): Array<ViewNode<T>> {
  if (Array.isArray(content)) {
    return content.flatMap(flattenToContentNodes);
  }

  if (content instanceof ViewNode) {
    return [content];
  }

  if (content instanceof DeferredComponent) {
    return [new DeferredComponentViewNode(content)];
  }

  if (isStampedSignal(content) || isWritableSignal(content)) {
    const fragment = new ViewElementNode<T>();
    effect(() => {
      const value = read<T>(content);
      fragment.addChild(...flattenToContentNodes<T>(value));
      markDirty();
      return () => {
        fragment.clear();
      };
    });
    return [fragment];
  }

  if (typeof content === 'function') {
    const component = content as () => Recursive<T | ViewNode<T>>;
    return flattenToContentNodes(component());
  }

  if (isSlot(content)) {
    return [(content as SlotImpl<ViewNodeKindBase>).node];
  }

  return [new ViewContentNode(content)];
}
