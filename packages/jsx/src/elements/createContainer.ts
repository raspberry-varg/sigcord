import {
  effect,
  flatten,
  flattenToContentNodes,
  markDirty,
  type Owner,
  read,
  ViewManualComputedElementNode,
  type ViewNode,
} from '@sigcord/core';
import { ContainerBuilder, type ContainerComponentBuilder, TextDisplayBuilder } from 'discord.js';

import type { IntrinsicElementProps } from '../index.js';

class ContainerElement extends ViewManualComputedElementNode<ContainerBuilder> {
  private containerOwner?: Owner;

  constructor(
    private readonly container: ContainerBuilder,
    private readonly nodes: readonly ViewNode[],
  ) {
    super();
  }

  override getFlattened(): ContainerBuilder | undefined {
    const flattened = flatten(this.nodes!, this.containerOwner);
    const content: ContainerComponentBuilder[] = [];
    for (const item of flattened) {
      if (typeof item === 'boolean' || typeof item === 'number' || typeof item === 'string') {
        content.push(new TextDisplayBuilder().setContent(String(item)));
        continue;
      }

      content.push(item as ContainerComponentBuilder);
    }
    this.container.spliceComponents(0, this.container.components.length, content);
    return content.length ? this.container : undefined;
  }

  override dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    this.containerOwner?.dispose();
    if (this.nodes) {
      for (let i = 0; i < this.nodes.length; i++) {
        this.nodes[i].dispose();
      }
    }
  }
}

export function createContainer(
  props: IntrinsicElementProps['container'],
): ViewNode<ContainerBuilder> {
  const container = new ContainerBuilder();
  if (props.accent || props.spoiler) {
    effect(() => {
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
      markDirty();
    });
  }

  const nodes = flattenToContentNodes(props.children);
  return new ContainerElement(container, nodes);
}
