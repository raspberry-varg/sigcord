import {underline} from 'discord.js';

import type {IntrinsicElementProps} from '../index.js';
import {resolveToConditionalFormatter} from '../util/resolveToConditionalFormatter.js';

export function createUnderline(props: IntrinsicElementProps['u']) {
  return resolveToConditionalFormatter(underline, props.children);
}
