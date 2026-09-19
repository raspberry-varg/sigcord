import { effect } from '../../framework/hooks/index.js';
import { untracked } from '../../lib/reactivity/untracked.js';

import { signal } from './signal.js';

import type { Signal, SignalTuple } from '../../lib/reactivity/core/signals.js';

export type LinkedSignalComputeFunction<SOURCE, OUT> = (
  currentSource: SOURCE,
  previousLinked?: OUT,
) => OUT;

/**
 * Creates a mutable signal that is automatically set to a computed value.
 * @param source The source signal whose value will be passed to {@link compute}.
 * @param compute Computes the next value in an untracked context when source is
 *   updated.
 */
export function linkedSignal<SOURCE, OUT>(
  source: Signal<SOURCE> | (() => SOURCE),
  compute: LinkedSignalComputeFunction<NoInfer<SOURCE>, OUT>,
): SignalTuple<OUT> {
  const backingSignal = signal<OUT>();

  effect(() => {
    const previousValue = untracked(backingSignal[0]);
    const currentSource = source();

    const computedValue = untracked(() => compute(currentSource, previousValue));
    backingSignal[1](computedValue);
  });

  // Type assertion is safe as effect() runs immediately and sets to the computed out.
  return backingSignal as SignalTuple<OUT>;
}
