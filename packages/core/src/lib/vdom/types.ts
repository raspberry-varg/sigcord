import type { Owner } from '../owners/owner.js';
import type { IntrinsicPropsMap } from './props.js';

export const NodeType = {
  Deferred: 0,
  Boundary: 1,
  Intrinsic: 2,
} as const;

export type NodeTypeValue = (typeof NodeType)[keyof typeof NodeType];

export interface DeferredNode {
  $$typeof: typeof NodeType.Deferred;
  componentFn: (props: Record<string, unknown>) => unknown;
  props: Record<string, unknown> | undefined;

  /**
   * Only used for creating a stack trace in debug mode.
   */
  _owner: Owner | null;
  _resolvedContent?: unknown;
}

export interface BoundaryNode {
  $$typeof: typeof NodeType.Boundary;
  boundaryOwner: Owner;
  children: unknown[];
}

export interface IntrinsicNode {
  $$typeof: typeof NodeType.Intrinsic;
  type: keyof IntrinsicPropsMap;
  props: Record<string, unknown>;
  _cached?: unknown;
}

export type VDOMObjectNode = DeferredNode | BoundaryNode | IntrinsicNode;

export type ViewNode =
  | VDOMObjectNode
  | string
  | null
  | undefined
  | { toJSON: () => unknown }
  | unknown;

export function isVDOMNode(node: unknown): node is VDOMObjectNode {
  return typeof node === 'object' && typeof (node as { $$typeof?: unknown }).$$typeof === 'number';
}
