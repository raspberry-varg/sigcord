import { type IntrinsicNode, NodeType } from './types.js';

import type { IntrinsicPropsMap } from './props.js';

export function h<K extends keyof IntrinsicPropsMap>(
  type: K,
  props: IntrinsicPropsMap[K],
): IntrinsicNode {
  return {
    $$typeof: NodeType.Intrinsic,
    type: type,
    props: (props as Record<string, unknown>) ?? {},
  };
}
