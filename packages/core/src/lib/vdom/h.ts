import { createDeferredNode } from './deferred.js';
import { createIntrinsicNode } from './intrinsic.js';
import { type DeferredNode, type IntrinsicNode } from './types.js';

import type { IntrinsicPropsMap } from './props.js';

/**
 * Hyper-script signature to create a new intrinsic node.
 */
export function h<K extends keyof IntrinsicPropsMap>(
  type: K,
  props?: IntrinsicPropsMap[K] | null,
): IntrinsicNode;

/**
 * Hyper-script signature to defer execution of a functional component.
 */
export function h<P>(type: (props: P) => unknown, props?: P | null): DeferredNode;
export function h(type: any, props: Record<string, unknown>): IntrinsicNode | DeferredNode {
  const finalProps = props ?? {};
  return typeof type === 'function'
    ? createDeferredNode(type, finalProps)
    : createIntrinsicNode(type, props);
}
