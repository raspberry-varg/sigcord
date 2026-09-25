// oxlint-disable no-underscore-dangle

import { type Owner, runWithOwner, setCurrentOwner } from '../owners/owner.js';
import { executeDeferredNode } from '../vdom/deferred.js';
import { isVDOMNode, NodeType } from '../vdom/index.js';
import { OwnerBoundaryViewNodeLegacy } from '../vdom/ownerBoundary.js';
import { ViewComputedElementNode } from '../vdom/viewComputedElementNode.js';
import { ViewContentNode } from '../vdom/viewContentNode.js';
import { ViewElementNode } from '../vdom/viewElementNode.js';
import { ViewManualComputedElementNode } from '../vdom/viewManualComputedElementNode.js';
import { ViewNodeLegacy } from '../vdom/viewNodeLegacy.js';

import { formatTextIntrinsic, isTextIntrinsic } from './formatTextIntrinsic.js';
import { mergeStrings } from './mergeStrings.js';
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
      if (item instanceof OwnerBoundaryViewNodeLegacy) {
        stack.push(flattenLegacy(item.children, item.owner) as any);
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

export function flatten(node: unknown, debugStack?: string): unknown {
  if (Array.isArray(node)) {
    const out: unknown[] = [];
    for (let i = 0; i < node.length; i++) {
      const next = flatten(node[i], debugStack);
      if (next != null && typeof next !== 'boolean') {
        mergeStrings(out, next);
      }
    }
    return out;
  }

  if (node == null || typeof node === 'boolean') {
    return null;
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (typeof node === 'function') {
    return flatten(node(), debugStack);
  }

  if (typeof (node as { toJSON?: unknown }).toJSON === 'function') {
    // Support Discord.js builders.
    return (node as { toJSON: () => unknown }).toJSON();
  }

  if (isVDOMNode(node)) {
    switch (node.$$typeof) {
      case NodeType.Boundary: {
        return runWithOwner(node.boundaryOwner, () => {
          const nextDebugStack = debugStack ? `${debugStack} > {BoundaryOwner}` : undefined;
          return flatten(node.children, nextDebugStack);
        });
      }
      case NodeType.Deferred: {
        if (!node._resolvedContent) {
          node._resolvedContent = executeDeferredNode(node);
        }
        const nextDebugStack = debugStack
          ? `${debugStack} > <${node.componentFn.name || 'Anonymous'}>`
          : undefined;

        if (node._owner) {
          return runWithOwner(node._owner, () => flatten(node._resolvedContent, nextDebugStack));
        } else {
          return flatten(node._resolvedContent, nextDebugStack);
        }
      }
      case NodeType.Intrinsic: {
        const nextDebugStack = debugStack ? `${debugStack} > <${node.type}>` : undefined;
        if (isTextIntrinsic(node.type)) {
          if (!node._cached) {
            node._cached = formatTextIntrinsic(node.type, node.props);
          }
          return flatten(node._cached, nextDebugStack);
        }

        const resolve = (values: unknown) => flatten(values, nextDebugStack);

        let resolvedChildren: unknown[] = [];
        if (node.props.children) {
          const res = resolve(node.props.children);
          resolvedChildren = Array.isArray(res) ? res : [res];
        }

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

  if (typeof node === 'object' && node.constructor !== Object) {
    throw new Error(
      `[Framework Error] VDOM Leak Detected!\n\n` +
        `Trace: ${debugStack || 'Unknown (Prod Mode)'}\n\n` +
        `A class instance (${node.constructor.name}) tried to leak into the Discord payload. ` +
        `This usually means an un-migrated legacy component returned a ViewNode.`,
    );
  }
  return node;
}
