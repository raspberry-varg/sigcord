import {
  flatten,
  flattenToContentNodes,
  getOwner,
  type Owner,
  ViewManualComputedElementNode,
  ViewNode,
} from '@sigcord/core';
import { ActionRowBuilder, type MessageActionRowComponentBuilder } from 'discord.js';

import type { IntrinsicElementProps } from '../index.js';

class RowNode extends ViewManualComputedElementNode<ActionRowBuilder | null> {
  constructor(
    private capturedOwner: Owner | null,
    private readonly actionRow: ActionRowBuilder,
    private readonly nodes: readonly ViewNode[],
  ) {
    super();
  }

  override getFlattened() {
    const content = flatten(this.nodes, this.capturedOwner);
    if (!content.length) {
      return null;
    }

    this.actionRow.setComponents(content as MessageActionRowComponentBuilder[]);
    return this.actionRow;
  }

  override dispose(): void {
    if (this.disposed) return;
    this._disposed = true;

    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].dispose();
    }
  }
}

export function createRow(props: IntrinsicElementProps['row']) {
  const actionRow = new ActionRowBuilder();
  const nodes = flattenToContentNodes(props.children);
  return new RowNode(getOwner(), actionRow, nodes);
}
