import { getCurrentSynapseOrDefault } from '../../lib/builtins/currentSynapse.js';
import { useCordInternalOrThrow } from '../cordContext.js';

/**
 * Manually schedule an update to the current view in a microtask.
 *
 * Note: Updates are automatically scheduled after the initial mount and after
 * each resolved interaction handler.
 */
export function update(): void {
  const legacy = getCurrentSynapseOrDefault();
  if (legacy) {
    legacy.scheduleUpdate();
    return;
  }
  const cord = useCordInternalOrThrow();
  cord.queueUpdate();
}
