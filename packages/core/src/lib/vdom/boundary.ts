import { type BoundaryNode, NodeType } from './types.js';

import type { Owner } from '../owners/owner.js';

export function createBoundaryNode(boundaryOwner: Owner, children: unknown[]): BoundaryNode {
  return {
    $$typeof: NodeType.Boundary,
    boundaryOwner,
    children,
  };
}
