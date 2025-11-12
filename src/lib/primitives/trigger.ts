import type { Signal } from '../Reactivity.js';
import { signal } from './signal.js';

/**
 * Create a signal with a trigger function.
 *
 * Useful for manually triggering subscribed effects.
 *
 * @returns Tuple containing a tracking signal and a function to trigger any
 *   subscribed effects.
 */
export function trigger(): [track: Signal<void>, dirty: () => void] {
  const [toggle, setToggle] = signal(false);
  return [toggle, () => setToggle((prev) => !prev)];
}
