import {TextDisplayBuilder} from 'discord.js';

import {ViewContentNode, patchEffect} from '@sigcord/core';

import type {IntrinsicElementProps} from '../index.js';
import {parseChildrenToString} from '../util/parseChildrenToString.js';

export function createTextDisplay(
  props: IntrinsicElementProps['text'],
): TextDisplayBuilder | ViewContentNode<TextDisplayBuilder> | null {
  const children = props.children;
  if (!children) {
    return null;
  }

  const textDisplay = new TextDisplayBuilder();
  if (typeof children === 'string') {
    textDisplay.setContent(children);
    return textDisplay;
  }

  const finalString = parseChildrenToString(children);

  if (typeof finalString === 'string') {
    if (!finalString) {
      return null;
    }
    textDisplay.setContent(String(finalString));
    return textDisplay;
  }

  const node = new ViewContentNode<TextDisplayBuilder>();
  patchEffect(() => {
    const str = finalString();
    if (!str) {
      return;
    }

    textDisplay.setContent(str);
    node.setContent(textDisplay);
    return () => {
      node.setContent(undefined);
    };
  });

  return node;
}
