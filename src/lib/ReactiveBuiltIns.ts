/**
 * This module contains built-ins that can be used in a synchronous reactive
 * view, removing the need to pass a `$` synapse prop to reactive components
 * or nested reactive views.
 *
 * `$` can still be accessed by a built-in getter for backwards-compatibility
 * with non-reactive views.
 */

import { Synapse } from './Synapse.js';
import { PatchTarget } from './RenderingEngine.js';
import { assert } from '../util/Assertions.js';

export const signal: Synapse['createSignal'] = <T>(
  fnOrValue: T | (() => T) | undefined = undefined,
  params = {},
  patchTarget = PatchTarget.None
) => useSynapse().createSignal(fnOrValue, params, patchTarget);

export const component: Synapse['component'] = (definition) => {
  const $ = useSynapse();
  return $.component(definition);
};

export function useSynapse(): Synapse {
  assert(currentSynapse, 'Not currently in a reactive view.');
  return currentSynapse;
}

let currentSynapse: Synapse | null = null;

export function setReactiveContext(synapse: Synapse): void {
  currentSynapse = synapse;
}

export function clearReactiveContext(): void {
  currentSynapse = null;
}
