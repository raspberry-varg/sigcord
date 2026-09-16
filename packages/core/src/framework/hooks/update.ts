import { useContext } from '../../lib/contexts/useContext.js';
import { CordContext } from '../cordContext.js';
import { getCurrentSynapse } from '../../lib/builtins/builtins.js';

export function update(): void {
  const cord = useContext(CordContext);
  if (!cord) {
    // Fallback to legacy behavior
    getCurrentSynapse().scheduleUpdate();
    return;
  }

  cord.queueUpdate();
}
