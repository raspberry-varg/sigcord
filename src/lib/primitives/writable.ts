import type { Synapse } from '../menu/instance/synapse.js';
import { useSynapse } from '../builtins/builtins.js';

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
