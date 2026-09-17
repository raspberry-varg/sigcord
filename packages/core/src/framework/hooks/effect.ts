import {
  createEffect,
  type EffectFn,
} from '../../lib/reactivity/core/signals.js';
import type { DisposeFn } from '../../lib/render/dispose.js';
import { getOwnerOrThrow, runWithOwner } from '../../lib/owners/owner.js';
import {
  PatchTarget,
  type PatchTargetBitMask,
} from '../../lib/RenderingEngine.js';
import { useCordInternal } from '../cordContext.js';
import { getCurrentSynapse } from '../../lib/builtins/builtins.js';

/**
 * @deprecated Use a simple effect and manually call {@link markDirty}.
 *
 * Create an effect that runs when signals referenced in the effect function
 * change.
 *
 * @param fn The effect to run.
 * @param patchTarget {@link PatchTarget} bit mask to queue for rendering.
 *   Useful when mutating content objects like component or embed builders to
 *   have the change reflected to the user.
 */
export function effect(
  fn: EffectFn,
  patchTarget: PatchTarget | undefined,
): DisposeFn;
/**
 * Create an effect that runs when signals referenced in the effect function
 * change.
 *
 * @param fn The effect to run.
 */
export function effect(fn: EffectFn): DisposeFn;
export function effect(
  fn: EffectFn,
  patchTarget?: PatchTargetBitMask,
): DisposeFn {
  const cord = useCordInternal();

  const capturedOwner = getOwnerOrThrow();
  if (patchTarget !== undefined && patchTarget !== PatchTarget.None) {
    return createEffect(() => {
      const result = runWithOwner(capturedOwner, fn);

      if (cord) {
        cord.markDirty(patchTarget);
      } else {
        // Fallback to legacy behavior.
        getCurrentSynapse().addPatchTargets(patchTarget);
      }

      return result;
    });
  }
  return createEffect(() => runWithOwner(capturedOwner, fn));
}
