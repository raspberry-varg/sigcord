import { guardDeclarative } from '../../core/utils/guardDeclarative.js';
import { createEffect, type EffectFn } from '../../lib/reactivity/core/signals.js';
import { inStaticCord } from '../staticCordContext.js';

import type { DisposeFn } from '../../lib/render/dispose.js';

const noop = () => {};

/**
 * Create an effect that runs when signals referenced in the effect function
 * change.
 *
 * @param fn The effect to run.
 */
export function effect(fn: EffectFn): DisposeFn {
  guardDeclarative('effect');
  if (inStaticCord()) {
    fn();
    return noop;
  }
  return createEffect(fn);
}
