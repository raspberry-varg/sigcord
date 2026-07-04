import {hyperlink} from 'discord.js';

import {computed, isSignal, read} from '@sigcord/core';

import {JSX} from '../jsx-runtime.js';
import {parseChildrenToString} from '../util/parseChildrenToString.js';
import {resolveString} from '../util/resolveString.js';

import IntrinsicElements = JSX.IntrinsicElements;

export function createAnchor(props: IntrinsicElements['a']) {
  const children = props.children;
  if (!children) {
    return '';
  }

  const displayText = parseChildrenToString(children);

  const title = props.title;
  const url = props.url;

  if (!(isSignal(displayText) || isSignal(url) || isSignal(title))) {
    return hyperlink(displayText, url, resolveString(title));
  }

  return computed(() => {
    const txt = read(displayText);
    if (!txt) {
      return '';
    }

    return hyperlink(txt, read(url), resolveString(read(title)));
  });
}
