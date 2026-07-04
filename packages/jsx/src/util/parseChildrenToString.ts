import {type Signal, computed, isSignal} from '@sigcord/core';

import {JSX, type JSXChildren, type Primitive} from '../index.js';
import {resolveString} from './resolveString.js';
import {tryPromoteToSignal} from './tryPromoteToSignal.js';
import {upgradeStringSequenceToReactive} from './upgradeStringSequenceToReactive.js';

export function parseChildrenToString(
  children: JSXChildren['children'],
): string | Signal<string> {
  let finalString: Signal<JSX.JSXNode> | Primitive = '';
  if (!Array.isArray(children)) {
    finalString = isSignal(children) ? children : resolveString(children);
  } else {
    for (let i = 0; i < children.length; i++) {
      const child = tryPromoteToSignal(children[i]);
      if (isSignal(child)) {
        finalString = upgradeStringSequenceToReactive(finalString, children, i);
        break;
      }
      if (children[i] !== undefined && children[i] !== null) {
        finalString += children[i];
      }
    }
  }

  return typeof finalString === 'string'
    ? finalString
    : computed(() => resolveString(finalString()));
}
