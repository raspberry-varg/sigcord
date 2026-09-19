import { guardDeclarative } from '../../core/utils/guardDeclarative.js';
import { type EffectFn, createEffect } from '../../lib/reactivity/core/signals.js';

import type { DisposeFn } from '../../lib/render/dispose.js';

/**
 * Create an effect that runs when signals referenced in the effect function
 * change.
 *
 * @param fn The effect to run.
 */
export function effect(fn: EffectFn): DisposeFn {
  guardDeclarative('effect');
  return createEffect(fn);
}
