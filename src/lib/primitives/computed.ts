import type { Synapse } from '../menu/synapse.js';
import { useSynapse } from '../ReactiveBuiltIns.js';

/**
 * Create a signal that only updates if any of its dependencies change.
 * @param derived Function with signal reads.
 * @returns Signal that has subscribed to any signals read during its initial
 *    call.
 */
export const computed: Synapse['createComputed'] = <T>(derived: () => T) =>
  useSynapse().createComputed(derived);
