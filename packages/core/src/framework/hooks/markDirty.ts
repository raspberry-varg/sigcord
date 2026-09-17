import { useCordInternal } from '../cordContext.js';
import { patch } from '../../lib/builtins/builtins.js';
import { PatchTarget } from '../../lib/RenderingEngine.js';

export function markDirty(target?: PatchTarget): void {
  const cord = useCordInternal();
  if (!cord) {
    // Legacy behavior.
    return target != null ? patch(target) : patch();
  }

  // TODO: Patch context should be pulled from the owner. Not really an issue
  // with V2 components, this'll only matter with V1.
  cord.markDirty(target ?? PatchTarget.All);
}
