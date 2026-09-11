import {
  ContainerBuilder,
  type ContainerComponentBuilder,
  TextDisplayBuilder,
} from 'discord.js';

import {
  type Owner,
  ViewManualComputedElementNode,
  type ViewNode,
  flatten,
  flattenToContentNodes,
  owner,
  patchEffect,
  read,
} from '@sigcord/core';

import type {IntrinsicElementProps} from '../index.js';

class ContainerElement extends ViewManualComputedElementNode<ContainerBuilder> {
  constructor(
    private readonly container: ContainerBuilder,
    private readonly containerOwner: Owner,
    private readonly nodes: readonly ViewNode[],
  ) {
    super();
  }

  override getFlattened(): ContainerBuilder | undefined {
    const flattened = flatten(this.nodes, this.containerOwner);
    const content: ContainerComponentBuilder[] = [];
    for (const item of flattened) {
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
    return content.length ? this.container : undefined;
  }

  override dispose(): void {
    if (this.disposed_) return;
    this.disposed_ = true;

    this.containerOwner.dispose();
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].dispose();
    }
  }
}

export function createContainer(
  props: IntrinsicElementProps['container'],
): ViewNode<ContainerBuilder> {
  // Render content immediately
  let nodes!: readonly ViewNode[];
  const container = new ContainerBuilder();
  const containerOwner = owner(() => {
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

    nodes = flattenToContentNodes(props.children);
  });

  return new ContainerElement(container, containerOwner, nodes);
}
