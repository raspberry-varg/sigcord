import {strikethrough} from 'discord.js';

import {JSX} from '../jsx-runtime.js';
import {resolveToConditionalFormatter} from '../util/resolveToConditionalFormatter.js';

import IntrinsicElements = JSX.IntrinsicElements;

export function createStrikethrough(props: IntrinsicElements['strike']) {
  return resolveToConditionalFormatter(strikethrough, props.children);
}
