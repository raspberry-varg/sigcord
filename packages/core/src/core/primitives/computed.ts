import { getCurrentSynapseOrDefault } from '../../lib/builtins/builtins.js';
import {
  createComputed,
  type Signal,
} from '../../lib/reactivity/core/signals.js';

/**
 * Create a signal that only updates if any of its dependencies change.
 * @param derived Function with signal reads.
 * @returns Signal that has subscribed to any signals read during its initial
 *    call.
 */
export function computed<T>(derived: () => T): Signal<T> {
  const legacy = getCurrentSynapseOrDefault();
  if (legacy) {
    return legacy.createComputed(derived);
  }
  return createComputed(derived);
}
