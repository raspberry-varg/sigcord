import { type DeferredComponent } from '../render/deferredComponent.js';
import { flattenToContentNodes } from '../render/flattenToContentNodes.js';

import { ViewNode } from './viewNode.js';

export class DeferredComponentViewNode extends ViewNode {
  private content?: ViewNode[];

  constructor(readonly deferredComponent: DeferredComponent<any>) {
    super();
  }

  execute() {
    if (!this.content) {
      this.content = flattenToContentNodes(this.deferredComponent.execute());
    }
    return this.content;
  }

  dispose(): void {
    if (this.content) {
      for (let i = 0; i < this.content.length; i++) {
        this.content[i].dispose();
      }
      this.content = undefined;
    }
  }
}
