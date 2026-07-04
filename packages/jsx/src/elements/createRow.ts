import {
  ActionRowBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';

import {
  type Owner,
  ViewManualComputedElementNode,
  flattenToContentNodes,
  owner,
} from '@sigcord/core';

import type {IntrinsicElementProps} from '../index.js';

class RowNode extends ViewManualComputedElementNode<ActionRowBuilder | null> {
  private readonly actionRow = new ActionRowBuilder();
  constructor(
    private readonly contentOwner: Owner<
      MessageActionRowComponentBuilder | boolean | null | undefined
    >,
  ) {
    super();
  }

  override getFlattened() {
    const content = this.contentOwner
      .flatten()
      .filter((content) => !!content && typeof content !== 'boolean');
    if (!content.length) {
      return null;
    }

    this.actionRow.setComponents(content.filter((c) => typeof c !== 'boolean'));
    return this.actionRow;
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed_ = true;

    this.contentOwner.dispose();
  }
}

export function createRow(props: IntrinsicElementProps['row']) {
  return new RowNode(
    owner<MessageActionRowComponentBuilder>(() =>
      flattenToContentNodes(props.children),
    ),
  );
}
