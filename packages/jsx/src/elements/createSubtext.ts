import {subtext} from 'discord.js';

import type {IntrinsicElementProps} from '../index.js';
import {resolveToConditionalFormatter} from '../util/resolveToConditionalFormatter.js';

export function createSubtext(props: IntrinsicElementProps['sub']) {
  return resolveToConditionalFormatter(subtext, props.children, true);
}
