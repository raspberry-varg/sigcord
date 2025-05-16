import {
  type Signalish,
  isWritableSignal,
  createUntracked,
} from '../Reactivity.js';

/**
 * Read a signal or callback of signals without subscribing it to the current
 * reactive context or effect.
 * @param signalOrFn Signal to read from or a function reading signals.
 */
export function untracked<T>(signalOrFn: Signalish<T> | (() => T)): T {
  if (isWritableSignal(signalOrFn)) {
    signalOrFn = signalOrFn.readonly();
  }
  return createUntracked(signalOrFn);
}
