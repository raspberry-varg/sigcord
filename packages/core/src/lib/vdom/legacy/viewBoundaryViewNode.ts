import { type Owner } from '../../owners/owner.js';

import { ViewNodeLegacy } from './viewNodeLegacy.js';

export class OwnerBoundaryViewNodeLegacy extends ViewNodeLegacy {
  constructor(
    readonly owner: Owner,
    readonly children: ViewNodeLegacy[],
  ) {
    super();
  }

  dispose(): void {
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].dispose();
    }
  }
}
