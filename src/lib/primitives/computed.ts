import type { Synapse } from '../menu/instance/synapse.js';
import { getCurrentSynapse } from '../builtins/builtins.js';

/**
 * Create a signal that only updates if any of its dependencies change.
 * @param derived Function with signal reads.
 * @returns Signal that has subscribed to any signals read during its initial
 *    call.
 */
export const computed: Synapse['createComputed'] = <T>(derived: () => T) =>
  getCurrentSynapse().createComputed(derived);
