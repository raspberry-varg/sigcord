import {bold} from 'discord.js';

import type {IntrinsicElementProps} from '../index.js';
import {resolveToConditionalFormatter} from '../util/resolveToConditionalFormatter.js';

export function createBold(props: IntrinsicElementProps['b']) {
  return resolveToConditionalFormatter(bold, props.children);
}
