import { createUntracked, type Signal } from './core/signals.js';

/**
 * Read a signal or callback of signals without subscribing it to the current
 * reactive context or effect.
 * @param signalOrFn Signal to read from or a function reading signals.
 */
export function untracked<T>(signalOrFn: (() => T) | Signal<T>): T {
  return createUntracked(signalOrFn);
}
