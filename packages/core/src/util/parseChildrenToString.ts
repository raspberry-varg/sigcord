import { computed } from '../core/primitives/index.js';
import { isSignal, type Signal } from '../lib/reactivity/core/signals.js';

import { resolveString } from './resolveString.js';
import { tryPromoteToSignal } from './tryPromoteToSignal.js';
import { upgradeStringSequenceToReactive } from './upgradeStringSequenceToReactive.js';

export function parseChildrenToString(children: unknown | unknown[]): string | Signal<string> {
  let finalString: Signal<unknown> | unknown = '';
  if (!Array.isArray(children)) {
    finalString = isSignal(children) ? children : resolveString(children);
  } else {
    for (let i = 0; i < children.length; i++) {
      const child = tryPromoteToSignal(children[i]);
      if (isSignal(child)) {
        finalString = upgradeStringSequenceToReactive(String(finalString), children, i);
        break;
      }
      finalString += resolveString(children[i]);
    }
  }

  return typeof finalString !== 'function'
    ? String(finalString)
    : computed(() => resolveString(finalString()));
}
