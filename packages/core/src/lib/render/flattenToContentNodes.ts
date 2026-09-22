import { effect, markDirty } from '../../framework/hooks/index.js';
import { read } from '../reactivity/core/read.js';
import { isStampedSignal, isWritableSignal } from '../reactivity/core/signals.js';
import { isSlot, SlotImpl } from '../Slot.js';
import { DeferredComponentViewNodeLegacy } from '../vdom/index.js';
import { ViewContentNode } from '../vdom/viewContentNode.js';
import { ViewElementNode } from '../vdom/viewElementNode.js';
import { ViewNodeLegacy } from '../vdom/viewNodeLegacy.js';

import { DeferredComponentLegacy } from './deferredComponent.js';

import type { Recursive } from '../recursive.js';
import type { ViewNodeKind, ViewNodeKindBase } from '../vdom/viewNodeKind.js';

export function flattenToContentNodes<T extends ViewNodeKind>(
  content: T,
): Array<ViewNodeLegacy<T>> {
  if (Array.isArray(content)) {
    return content.flatMap(flattenToContentNodes);
  }

  if (content instanceof ViewNodeLegacy) {
    return [content];
  }

  if (content instanceof DeferredComponentLegacy) {
    return [new DeferredComponentViewNodeLegacy(content)];
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
    const component = content as () => Recursive<T | ViewNodeLegacy<T>>;
    return flattenToContentNodes(component());
  }

  if (isSlot(content)) {
    return [(content as SlotImpl<ViewNodeKindBase>).node];
  }

  return [new ViewContentNode(content)];
}
