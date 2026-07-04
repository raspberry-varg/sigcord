import {type MaybeSignal, type Signal, computed, read} from '@sigcord/core';

import {JSX} from '../jsx-runtime.js';

export function upgradeStringSequenceToReactive(
  partialString: string,
  stringSequence: ReadonlyArray<MaybeSignal<JSX.JSXNode>>,
  nextIndex: number,
): Signal<string> {
  return computed(() => {
    let final = partialString;
    for (let i = nextIndex; i < stringSequence.length; i++) {
      const next = read(stringSequence[i]);
      if (next) {
        final += next;
      }
    }
    return final;
  });
}
