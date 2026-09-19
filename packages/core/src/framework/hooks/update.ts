import { getCurrentSynapse } from '../../lib/builtins/builtins.js';
import { useContext } from '../../lib/contexts/useContext.js';
import { CordContext } from '../cordContext.js';

/**
 * Manually schedule an update to the current view in a microtask.
 *
 * Note: Updates are automatically scheduled after the initial mount and after
 * each resolved interaction handler.
 */
export function update(): void {
  const cord = useContext(CordContext);
  if (!cord) {
    // Fallback to legacy behavior
    getCurrentSynapse().scheduleUpdate();
    return;
  }

  cord.queueUpdate();
}
