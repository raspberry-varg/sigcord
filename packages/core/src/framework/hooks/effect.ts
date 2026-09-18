import {
  createEffect,
  type EffectFn,
} from '../../lib/reactivity/core/signals.js';
import type { DisposeFn } from '../../lib/render/dispose.js';
import { markDirty } from './markDirty.js';
import { PatchTarget, type PatchTargetBitMask } from '../patchTarget.js';
import { guardDeclarative } from '../../core/utils/guardDeclarative.js';

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
  guardDeclarative('effect');

  if (patchTarget !== undefined && patchTarget !== PatchTarget.None) {
    return createEffect(() => {
      const result = fn();
      markDirty(patchTarget);
      return result;
    });
  }
  return createEffect(fn);
}
