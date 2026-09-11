import {
  ActionRowBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';

import {
  type Owner,
  ViewManualComputedElementNode,
  ViewNode,
  flatten,
  flattenToContentNodes,
  owner,
} from '@sigcord/core';

import type {IntrinsicElementProps} from '../index.js';

class RowNode extends ViewManualComputedElementNode<ActionRowBuilder | null> {
  private readonly actionRow = new ActionRowBuilder();
  constructor(
    private readonly contentOwner: Owner,
    private readonly nodes: readonly ViewNode[],
  ) {
    super();
  }

  override getFlattened() {
    const content = flatten(this.nodes, this.contentOwner);
    if (!content.length) {
      return null;
    }

    this.actionRow.setComponents(content as MessageActionRowComponentBuilder[]);
    return this.actionRow;
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed_ = true;

    this.contentOwner?.dispose();
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].dispose();
    }
  }
}

export function createRow(props: IntrinsicElementProps['row']) {
  let nodes!: readonly ViewNode[];
  const contentOwner = owner(() => {
    nodes = flattenToContentNodes(props.children);
  });
  return new RowNode(contentOwner, nodes);
}
