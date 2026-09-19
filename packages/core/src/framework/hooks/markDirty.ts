import { getCurrentSynapseOrDefault } from '../../lib/builtins/builtins.js';
import { useCordInternalOrThrow } from '../cordContext.js';
import { PatchTarget } from '../patchTarget.js';

import { usePatchTarget } from './usePatchTarget.js';

export function markDirty(target: PatchTarget = usePatchTarget()): void {
  const legacy = getCurrentSynapseOrDefault();
  if (legacy) {
    if (target != null) {
      legacy.addPatchTargets(target);
    }
    return;
  }

  const cord = useCordInternalOrThrow();
  cord.markDirty(target);
}
