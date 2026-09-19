import { effect, markDirty } from "../../framework/hooks/index.js";
import { SlotImpl, isSlot } from "../Slot.js";
import { ViewContentNode } from "../dom/viewContentNode.js";
import { ViewElementNode } from "../dom/viewElementNode.js";
import { ViewNode } from "../dom/viewNode.js";
import type { ViewNodeKind, ViewNodeKindBase } from "../dom/viewNodeKind.js";
import { read } from "../reactivity/core/read.js";
import {
  isStampedSignal,
  isWritableSignal,
} from "../reactivity/core/signals.js";
import type { Recursive } from "../recursive.js";
import { DeferredComponent } from "./deferredComponent.js";

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

  if (typeof content === "function") {
    return flattenToContentNodes(
      (content as () => Recursive<T | ViewNode<T>>)(),
    );
  }

  if (isSlot(content)) {
    return [(content as SlotImpl<ViewNodeKindBase>).node];
  }

  return [new ViewContentNode(content)];
}
