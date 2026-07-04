import {spoiler} from 'discord.js';

import {JSX} from '../jsx-runtime.js';
import {resolveToConditionalFormatter} from '../util/resolveToConditionalFormatter.js';

import IntrinsicElements = JSX.IntrinsicElements;

export function createSpoiler(props: IntrinsicElements['spoiler']) {
  return resolveToConditionalFormatter(spoiler, props.children);
}
