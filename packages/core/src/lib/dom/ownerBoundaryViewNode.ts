import { ViewNode } from './viewNode.js';

import type { Owner } from '../owners/owner.js';

export class OwnerBoundaryViewNode extends ViewNode {
  constructor(
    readonly owner: Owner,
    readonly children: ViewNode[],
  ) {
    super();
  }

  dispose(): void {
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].dispose();
    }
  }
}
