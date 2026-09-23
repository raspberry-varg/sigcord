import { computed } from '../core/primitives/index.js';
import { read } from '../lib/reactivity/core/read.js';

import type { MaybeSignal, Signal } from '../lib/reactivity/core/signals.js';

export function upgradeStringSequenceToReactive(
  partialString: string,
  stringSequence: ReadonlyArray<MaybeSignal<unknown>>,
  nextIndex: number,
): Signal<string> {
  return computed(() => {
    let final = partialString;
    for (let i = nextIndex; i < stringSequence.length; i++) {
      const next = read(stringSequence[i]);
      if (next != null && next !== false) {
        final += next;
      }
    }
    return final;
  });
}
