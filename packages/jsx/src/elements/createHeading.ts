import {type HeadingLevel, heading} from 'discord.js';

import type {IntrinsicElementProps} from '../index.js';
import {resolveToConditionalFormatter} from '../util/resolveToConditionalFormatter.js';

export function createHeading(
  props: IntrinsicElementProps['h1' | 'h2' | 'h3'],
  level: HeadingLevel,
) {
  return resolveToConditionalFormatter(
    (s) => heading(s, level as HeadingLevel.One),
    props.children,
    true,
  );
}
