import {
  isSignal,
  isWritableSignal,
  type Signal,
  type WritableSignal,
} from './signals.js';

/**
 * Resolves a possible signal to its held value.
 */
export function read<T>(maybeSignal: T | Signal<T> | WritableSignal<T>): T {
  return isWritableSignal(maybeSignal)
    ? maybeSignal.get()
    : isSignal(maybeSignal) || typeof maybeSignal === 'function'
      ? (maybeSignal as () => T)()
      : maybeSignal;
}
