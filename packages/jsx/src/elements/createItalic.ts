import {italic} from 'discord.js';

import type {IntrinsicElementProps} from '../index.js';
import {resolveToConditionalFormatter} from '../util/resolveToConditionalFormatter.js';

export function createItalic(props: IntrinsicElementProps['i']) {
  return resolveToConditionalFormatter(italic, props.children);
}
