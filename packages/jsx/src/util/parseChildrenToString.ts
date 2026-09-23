import { computed, isSignal, type Signal } from '@sigcord/core';

import { type JSXChildren } from '../index.js';

import { resolveString } from './resolveString.js';
import { tryPromoteToSignal } from './tryPromoteToSignal.js';
import { upgradeStringSequenceToReactive } from './upgradeStringSequenceToReactive.js';

export function parseChildrenToString(children: JSXChildren['children']): string | Signal<string> {
  let finalString: any = '';
  if (!Array.isArray(children)) {
    finalString = isSignal(children) ? children : (resolveString(children) as any);
  } else {
    for (let i = 0; i < children.length; i++) {
      const child = tryPromoteToSignal(children[i]);
      if (isSignal(child)) {
        finalString = upgradeStringSequenceToReactive(finalString, children, i);
        break;
      }
      finalString += resolveString(children[i]);
    }
  }

  return typeof finalString === 'string'
    ? finalString
    : computed(() => resolveString(finalString()));
}
