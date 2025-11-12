import type { Synapse } from './menu/synapse.js';
import { useSynapse } from './ReactiveBuiltIns.js';
import { type Signal } from './Reactivity.js';

/**
 * Create a new signal.
 *
 * Signals are functions that allow for fine-grained reactivity in an app,
 * triggering reactions ("effects") **only if** their value changes.
 *
 * ```ts
 * const [clicks, setClicks] = signal(0);
 * const button = createDiscordButton();
 * componentEffect(() => {
 *   // subscribes to this signal and re-runs any time this signal changes
 *   button.label = `You have clicked me ${clicks()} times.`;
 * });
 *
 * return component({
 *   id: 'my-component',
 *   controller: (buttonInteraction) => {
 *     // updates clicks without reading the signal
 *     setClicks((prev) => prev + 1);
 *   }
 * });
 * ```
 *
 * In DIM, signals automatically bind to the render cycle. If you need to
 * completely re-run an entire function if any subscribed signal changes, or to
 * incrementally migrate a component to be fully reactive, wrap the embed or
 * component in a closure:
 *
 * ```ts
 * const [clicks, setClicks] = signal(0);
 * return {
 *   embeds: [
 *     () =>
 *       new EmbedBuilder()
 *         .setDescription(`You clicked the button below ${clicks()} times!`),
 *   ],
 *   components: [
 *     // ...
 *   ]
 * }
 * ```
 *
 * @param initialValue The initial value to set to the signal. Omit to assign
 *    later.
 * @returns Signal tuple with a signal getter and setter.
 */
export const signal: Synapse['createSignal'] = <T>(
  initialValue: T | undefined = undefined,
) => useSynapse().createSignal(initialValue);

/**
 * Create an object to modify and read from a single signal. Capable of being
 * split into a signal tuple or standalone signal.
 * @param initialValue The initial value to set to the signal. Omit to assign
 *    later.
 * @returns Object containing signal read and mutators.
 */
export const writable: Synapse['createWritableSignal'] = <T>(
  initialValue: T | undefined = undefined,
) => useSynapse().createWritableSignal(initialValue);

/**
 * Create a signal that only updates if any of its dependencies change.
 * @param derived Function with signal reads.
 * @returns Signal that has subscribed to any signals read during its initial
 *    call.
 */
export const computed: Synapse['createComputed'] = <T>(derived: () => T) =>
  useSynapse().createComputed(derived);

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
