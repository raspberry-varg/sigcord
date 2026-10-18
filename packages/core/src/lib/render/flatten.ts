// oxlint-disable no-underscore-dangle

import { runWithOwner } from '../owners/owner.js';
import { executeDeferredNode } from '../vdom/deferred.js';
import { isVDOMNode, NodeType } from '../vdom/index.js';

import { formatTextIntrinsic, isTextIntrinsic } from './formatTextIntrinsic.js';
import { mergeStrings } from './mergeStrings.js';
import { mountIntrinsic } from './mountIntrinsic.js';
import { updateIntrinsicChildren } from './updateIntrinsicChildren.js';

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
