import { Cord } from '../framework/cord.js';
import type { ViewElementNode } from '../lib/dom/viewElementNode.js';
import type { ViewNodeKind } from '../lib/dom/viewNodeKind.js';

interface V2Instance {
  owner: string;
  root: ViewElementNode;
}

export class CordV2 extends Cord {
  constructor(
    id: string,
    private initialFactory: () => ViewNodeKind,
  ) {
    super(id);
  }
}
