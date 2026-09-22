import {
  flattenLegacy,
  flattenToContentNodes,
  getOwner,
  type Owner,
  type Signal,
  ViewManualComputedElementNode,
  ViewNodeLegacy,
} from '@sigcord/core';
import {
  type APIButtonComponent,
  type APIThumbnailComponent,
  ButtonBuilder,
  ComponentBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';

import { isButtonData } from '../util/isButtonData.js';
import { isTextDisplayData } from '../util/isTextDisplayData.js';
import { isThumbnailData } from '../util/isThumbnailData.js';

import type { IntrinsicElementProps } from '../index.js';

class SectionElement extends ViewManualComputedElementNode<SectionBuilder | TextDisplayBuilder> {
  constructor(
    private readonly capturedOwner: Owner | null,
    private readonly accessoryNodes: readonly ViewNodeLegacy[],
    private readonly textNodes: readonly ViewNodeLegacy[],
  ) {
    super();
  }

  override dispose(): void {
    if (this.disposed) return;
    this._disposed = true;
    for (let node of this.accessoryNodes) {
      node.dispose();
    }
    for (let node of this.textNodes) {
      node.dispose();
    }
  }

  override getFlattened() {
    const accessory = this.resolveAccessory();
    const text = flattenLegacy(this.textNodes, this.capturedOwner);
    const textBuilders: TextDisplayBuilder[] = [];
    let currentString: Signal<string> | string = '';
    for (let t of text) {
      if (!t) {
        continue;
      }

      if (typeof t === 'string' || typeof t === 'number' || typeof t === 'boolean') {
        currentString += t;
        continue;
      }

      if (currentString) {
        textBuilders.push(new TextDisplayBuilder().setContent(currentString));
        currentString = '';
      }

      if (isTextDisplayData(t)) {
        textBuilders.push(new TextDisplayBuilder(t));
        continue;
      }

      if (t instanceof TextDisplayBuilder) {
        textBuilders.push(t);
        continue;
      }

      throw new Error(`Invalid child type for <section>. Expected TextDisplay kind, got: ${t}`);
    }
    if (currentString) {
      textBuilders.push(new TextDisplayBuilder().setContent(currentString));
    }
    if (!accessory) {
      return textBuilders;
    }

    const section = new SectionBuilder().addTextDisplayComponents(textBuilders);
    if (accessory instanceof ThumbnailBuilder) {
      section.setThumbnailAccessory(accessory);
    } else if (accessory instanceof ButtonBuilder) {
      section.setButtonAccessory(accessory);
    }

    return section;
  }

  private resolveAccessory():
    | ButtonBuilder
    | ThumbnailBuilder
    | APIButtonComponent
    | APIThumbnailComponent
    | null {
    const accessoryResult = flattenLegacy(this.accessoryNodes, this.capturedOwner);
    if (!accessoryResult.length) {
      return null;
    }

    if (accessoryResult.length > 1) {
      throw new Error(`Accessory must only be a single element. Got ${accessoryResult.length}.`);
    }

    const accessory = accessoryResult[0];
    if (accessory instanceof ComponentBuilder) {
      if (accessory instanceof ButtonBuilder || accessory instanceof ThumbnailBuilder) {
        return accessory;
      }
    }

    if (isButtonData(accessory)) {
      return new ButtonBuilder(accessory);
    }
    if (isThumbnailData(accessory)) {
      return new ThumbnailBuilder(accessory);
    }

    throw new Error(
      `Accessory must be a thumbnail builder, a button builder, or button data. Got: ${JSON.stringify(accessory)}`,
    );
  }
}

export function createSection(props: IntrinsicElementProps['section']) {
  const accessory = props.accessory;
  const children = props.children;
  if (!accessory) {
    return children;
  }

  const accessoryNodes = flattenToContentNodes(accessory);
  const childrenNodes = flattenToContentNodes(children);

  return new SectionElement(getOwner(), accessoryNodes, childrenNodes);
}
