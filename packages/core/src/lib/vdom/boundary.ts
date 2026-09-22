import { type BoundaryNode, NodeType, type ViewNode } from './types.js';

import type { Owner } from '../owners/owner.js';

export function createBoundaryNode(boundaryOwner: Owner, children: ViewNode[]): BoundaryNode {
  return {
    $$typeof: NodeType.Boundary,
    boundaryOwner,
    children,
  };
}
