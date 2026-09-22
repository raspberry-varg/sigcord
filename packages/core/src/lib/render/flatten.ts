// oxlint-disable no-underscore-dangle

import { type Owner, runWithOwner, setCurrentOwner } from '../owners/owner.js';
import { DeferredComponentViewNodeLegacy, executeDeferredNode } from '../vdom/deferred.js';
import { isVDOMNode, NodeType } from '../vdom/index.js';
import { OwnerBoundaryViewNode } from '../vdom/ownerBoundaryViewNode.js';
import { ViewComputedElementNode } from '../vdom/viewComputedElementNode.js';
import { ViewContentNode } from '../vdom/viewContentNode.js';
import { ViewElementNode } from '../vdom/viewElementNode.js';
import { ViewManualComputedElementNode } from '../vdom/viewManualComputedElementNode.js';
import { ViewNodeLegacy } from '../vdom/viewNodeLegacy.js';

import { flattenToContentNodes } from './flattenToContentNodes.js';
import { formatTextIntrinsic, isTextIntrinsic } from './formatTextIntrinsic.js';
import { mountIntrinsic } from './mountIntrinsic.js';
import { updateIntrinsicChildren } from './updateIntrinsicChildren.js';

import type { ReadonlyRecursive } from '../recursive.js';
import type { ViewNodeKindBase } from '../vdom/viewNodeKind.js';
import type { ViewComponent } from '../views/viewFlavors.js';

type ExcludeEmptyTypes<T> = NonNullable<Exclude<T, boolean>>;

export function flattenLegacy<T extends ViewNodeKindBase>(
  root: ViewNodeLegacy<T> | ReadonlyArray<ViewNodeLegacy<T>>,
  owner: Owner | null,
): Array<ExcludeEmptyTypes<T>> {
  const flattened: Array<ExcludeEmptyTypes<T>> = [];
  const stack: ReadonlyRecursive<ViewComponent | ViewNodeLegacy<ViewComponent>>[] = Array.isArray(
    root,
  )
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
        const content = runWithOwner(owner, () => item.getFlattened());
        stack.push(content);
        continue;
      }
      if (item instanceof ViewComputedElementNode) {
        const content = runWithOwner(owner, () =>
          item.computer(flattenLegacy(item.children, owner)),
        );
        stack.push(content);
        continue;
      }
      if (item instanceof ViewElementNode) {
        stack.push(item.children);
        continue;
      }
      if (item instanceof OwnerBoundaryViewNode) {
        stack.push(flattenLegacy(item.children, item.owner) as any);
        continue;
      }
      if (item instanceof DeferredComponentViewNodeLegacy) {
        stack.push(flattenToContentNodes(item.execute()));
        continue;
      }
      if (item instanceof ViewNodeLegacy) {
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

export function flatten(node: unknown, currentOwner: Owner | null): unknown {
  if (Array.isArray(node)) {
    return node.flatMap((n) => flatten(n, currentOwner));
  }

  if (node == null || typeof node === 'boolean') {
    return null;
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (typeof (node as { toJSON?: unknown }).toJSON === 'function') {
    // Support Discord.js builders.
    return (node as { toJSON: () => unknown }).toJSON();
  }

  if (isVDOMNode(node)) {
    switch (node.$$typeof) {
      case NodeType.Deferred:
        if (!node._resolvedContent) {
          node._resolvedContent = executeDeferredNode(node);
        }
        return node._resolvedContent;
      case NodeType.Intrinsic:
        if (isTextIntrinsic(node.type)) {
          if (!node._cached) {
            node._cached = formatTextIntrinsic(node.type, node.props);
          }
          return typeof node._cached === 'function' ? node._cached() : node._cached;
        }

        const resolve = (values: unknown) => flatten(values, currentOwner);
        const resolvedChildren = node.props.children ? resolve(node.props.children) : [];

        if (!node._cached) {
          node._cached = mountIntrinsic(node.type, node.props);
        }

        return updateIntrinsicChildren(
          node.type,
          node.props,
          node._cached,
          resolvedChildren,
          resolve,
        );
    }
  }
}
