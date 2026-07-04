import {inlineCode} from 'discord.js';

import type {IntrinsicElementProps} from '../index.js';
import {resolveToConditionalFormatter} from '../util/resolveToConditionalFormatter.js';

export function createInlineCode(props: IntrinsicElementProps['pre']) {
  return resolveToConditionalFormatter(inlineCode, props.children);
}
