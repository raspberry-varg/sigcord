import { untracked } from '../lib/reactivity/untracked.js';

import { maybeApplyFormat } from './maybeApplyFormat.js';
import { parseChildrenToString } from './parseChildrenToString.js';

export function resolveToConditionalFormatter(
  formatter: (original: string) => string,
  children: unknown,
  appendNewline = false,
) {
  const finalString = parseChildrenToString(children);
  if (typeof finalString === 'string') {
    return maybeApplyFormat(formatter, finalString, appendNewline);
  }
  return () => maybeApplyFormat(formatter, untracked(finalString), appendNewline);
}
