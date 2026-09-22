import { computed } from '@sigcord/core';

import { maybeApplyFormat } from './maybeApplyFormat.js';
import { parseChildrenToString } from './parseChildrenToString.js';

import type { JSXNode } from '../index.js';

export function resolveToConditionalFormatter(
  formatter: (original: string) => string,
  children: JSXNode | JSXNode[],
  appendNewline = false,
) {
  const finalString = parseChildrenToString(children);
  if (typeof finalString === 'string') {
    return maybeApplyFormat(formatter, finalString, appendNewline);
  }
  return computed(() => maybeApplyFormat(formatter, finalString(), appendNewline));
}
