import {
  type APIButtonComponent,
  ButtonBuilder,
  ComponentBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';

import {
  type Owner,
  type Signal,
  ViewManualComputedElementNode,
  flattenToContentNodes,
  owner,
} from '@sigcord/core';

import type {IntrinsicElementProps} from '../index.js';
import {isButtonData} from '../util/isButtonData.js';
import {isTextDisplayData} from '../util/isTextDisplayData.js';

class SectionElement extends ViewManualComputedElementNode<
  SectionBuilder | TextDisplayBuilder
> {
  constructor(
    private readonly accessoryOwner: Owner<ButtonBuilder | ThumbnailBuilder>,
    private readonly textOwner: Owner<TextDisplayBuilder | string>,
  ) {
    super();
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed_ = true;
    this.accessoryOwner.dispose();
    this.textOwner.dispose();
  }

  override getFlattened() {
    const accessory = this.resolveAccessory();
    const text = this.textOwner.flatten();
    const textBuilders: TextDisplayBuilder[] = [];
    let currentString: Signal<string> | string = '';
    for (let t of text) {
      if (!t) {
        continue;
      }

      if (
        typeof t === 'string' ||
        typeof t === 'number' ||
        typeof t === 'boolean'
      ) {
        currentString += t;
        continue;
      }

      if (currentString) {
        textBuilders.push(new TextDisplayBuilder().setContent(currentString));
        currentString = '';
      }

      if (isTextDisplayData(t)) {
        textBuilders.push(t);
        continue;
      }

      if (t instanceof TextDisplayBuilder) {
        textBuilders.push(t);
        continue;
      }

      throw new Error(
        'Invalid child type for <section>. ' +
          `Expected TextDisplay kind, got: ${t}`,
      );
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
    } else {
      section.setButtonAccessory(accessory);
    }

    return section;
  }

  private resolveAccessory():
    | ButtonBuilder
    | ThumbnailBuilder
    | APIButtonComponent
    | null {
    const accessoryResult = this.accessoryOwner.flatten();
    if (!accessoryResult.length) {
      return null;
    }

    if (accessoryResult.length > 1) {
      throw new Error(
        `Accessory must only be a single element. Got ${accessoryResult.length}.`,
      );
    }

    const accessory = accessoryResult[0];
    if (accessory instanceof ComponentBuilder) {
      if (
        accessory instanceof ButtonBuilder ||
        accessory instanceof ThumbnailBuilder
      ) {
        return accessory;
      }
    }

    if (isButtonData(accessory)) {
      return accessory;
    }

    throw new Error(
      `Accessory must be a thumbnail builder, a button builder, or button data. Got: ${accessory}`,
    );
  }
}

export function createSection(props: IntrinsicElementProps['section']) {
  const accessory = props.accessory;
  const children = props.children;
  if (!accessory) {
    return children;
  }

  const accessoryOwner = owner<ButtonBuilder>(() => {
    return flattenToContentNodes(accessory);
  });

  const childrenOwner = owner<TextDisplayBuilder>(() => {
    return flattenToContentNodes(children);
  });

  return new SectionElement(accessoryOwner, childrenOwner);
}
