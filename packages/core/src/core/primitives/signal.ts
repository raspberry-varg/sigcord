import { getCurrentSynapseOrDefault } from '../../lib/builtins/currentSynapse.js';
import { type SignalTuple, createSignal } from '../../lib/reactivity/core/signals.js';

/**
 * Create a new signal.
 *
 * Signals are functions that allow for fine-grained reactivity in an app,
 * triggering reactions ("effects") **only if** their value changes.
 *
 * ```ts
 * const [clicks, setClicks] = signal(0);
 * const button = createDiscordButton('my-button');
 * effect(() => {
 *   // Subscribes to this signal and re-runs any time this signal changes
 *   button.label = `You have clicked me ${clicks()} times.`;
 *   markDirty();
 * });
 *
 * useComponentHandler('my-button', ((button) => {
 *   setClicks((prev) => prev + 1);
 * }));
 *
 * return button;
 * ```
 *
 * @param initialValue The initial value to set to the signal.
 * @returns Signal tuple with a signal getter and setter.
 */
export function signal<T>(initialValue?: undefined): SignalTuple<T | undefined>;
export function signal<T>(initialValue: T): SignalTuple<T>;
export function signal<T>(initialValue?: T): SignalTuple<T | undefined> {
  const legacy = getCurrentSynapseOrDefault();
  if (legacy) {
    // Route to legacy behavior.
    return legacy.createSignal(initialValue);
  }
  return createSignal(initialValue).split();
}
