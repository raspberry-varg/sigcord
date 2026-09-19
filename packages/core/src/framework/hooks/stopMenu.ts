import { getCurrentSynapseOrDefault } from '../../lib/builtins/currentSynapse.js';
import { useCordInternalOrThrow } from '../cordContext.js';

import type { BuiltInCloseReasons } from '../cord.js';

export function stopMenu(reason?: BuiltInCloseReasons | (string & {}), data?: unknown): void {
  const legacy = getCurrentSynapseOrDefault();
  if (legacy) {
    legacy.stop(reason);
    return;
  }
  void useCordInternalOrThrow().stop(reason, data);
}
