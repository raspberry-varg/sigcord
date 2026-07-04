import {
  ContainerBuilder,
  type ContainerComponentBuilder,
  TextDisplayBuilder,
} from 'discord.js';

import {
  type Owner,
  ViewManualComputedElementNode,
  type ViewNode,
  flattenToContentNodes,
  owner,
  patchEffect,
  read,
} from '@sigcord/core';

import type {IntrinsicElementProps} from '../index.js';

class ContainerElement extends ViewManualComputedElementNode<ContainerBuilder> {
  constructor(
    private readonly container: ContainerBuilder,
    private readonly contentOwner: Owner,
  ) {
    super();
  }

  override getFlattened(): ContainerBuilder | ContainerBuilder[] | undefined {
    const flattened = this.contentOwner.flatten();
    const content: ContainerComponentBuilder[] = [];
    for (const item of flattened) {
      if (!item) {
        continue;
      }

      if (
        typeof item === 'boolean' ||
        typeof item === 'number' ||
        typeof item === 'string'
      ) {
        content.push(new TextDisplayBuilder().setContent(String(item)));
        continue;
      }

      content.push(item as ContainerComponentBuilder);
    }
    this.container.spliceComponents(
      0,
      this.container.components.length,
      content,
    );
    return this.container;
  }

  override dispose(): void {
    if (this.disposed_) return;
    this.disposed_ = true;

    this.contentOwner.dispose();
  }
}

export function createContainer(
  props: IntrinsicElementProps['container'],
): ViewNode<ContainerBuilder> {
  const container = new ContainerBuilder();

  if (props.accent || props.spoiler) {
    patchEffect(() => {
      if (props.accent) {
        const color = read(props.accent);
        if (color === null || color === undefined || color === false) {
          container.clearAccentColor();
        } else {
          container.setAccentColor(color === true ? 1 : color);
        }
      }
      if (props.spoiler) {
        container.setSpoiler(read(props.spoiler));
      }
    });
  }

  return new ContainerElement(
    container,
    owner(() => flattenToContentNodes(props.children)),
  );
}
