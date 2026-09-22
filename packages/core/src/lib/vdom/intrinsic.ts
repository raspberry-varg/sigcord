import { type IntrinsicNode, NodeType } from './types.js';

import type { IntrinsicPropsMap } from './props.js';

export function createIntrinsicNode(
  type: keyof IntrinsicPropsMap,
  props: Record<string, unknown>,
): IntrinsicNode {
  return {
    $$typeof: NodeType.Intrinsic,
    type,
    props,
    _cached: undefined,
  };
}
