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
import {
  createUntracked,
  type Resource,
  type ResourceTuple,
} from './Reactivity.js';

let currentSynapse: Synapse | null = null;

export function useSynapse(): Synapse {
  assert(currentSynapse, 'Not currently in a reactive view.');
  return currentSynapse;
}

export function withReactiveContext(synapse: Synapse) {
  const prev = currentSynapse;
  currentSynapse = synapse;
  return {
    [Symbol.dispose]: () => {
      currentSynapse = prev;
    },
  };
}

export function getCurrentReactiveContext(): Synapse | null {
  return currentSynapse;
}

export function setReactiveContext(synapse: Synapse | null) {
  currentSynapse = synapse;
}

export const resumable: Synapse['resumableSuspend'] = (action) =>
  useSynapse().resumableSuspend(action);

// - - - - - - -
// Begin globals
// - - - - - - -

// Signals

export const signal: Synapse['createSignal'] = <T>(
  fnOrValue: T | (() => T) | undefined = undefined,
) => useSynapse().createSignal(fnOrValue);

export const writable: Synapse['createWritableSignal'] = <T>(
  fnOrValue: T | (() => T) | undefined = undefined,
) => useSynapse().createWritableSignal(fnOrValue);

export const computed: Synapse['createComputed'] = <T>(fn: () => T) =>
  useSynapse().createComputed(fn);

export function untracked<T>(signal: () => T): T {
  return createUntracked(signal);
}

export function resource<T>(
  getResource: () => Promise<T>,
): ResourceTuple<T | undefined> {
  const [resolvedResource, setResolvedResource] = signal<T>();
  const [loading, setLoading] = signal(false);
  const fetch = () => {
    setLoading(true);
    getResource().then((result) => {
      setResolvedResource(result);
      setLoading(false);
    });
  };
  fetch();

  return [
    Object.assign(resolvedResource, {
      isLoading: loading,
    }) satisfies Resource<T | undefined>,
    setResolvedResource,
    fetch,
  ];
}

// Signal effects

/**
 * Create an effect that runs when the value of signals in the function are
 * changed.
 *
 * **Note:** This does **not** queue a patch to the message content, embeds,
 * or components. To have a patch queued on effect run, use
 * {@link embedEffect} or {@link componentEffect} instead. To
 * queue a patch for content, set content to a function that returns a string.
 * @param fn The effect to run.
 * @param params Extra configuration for debugging.
 * @param patchTarget Bitfield of {@link PatchTarget} to queue for rendering
 * when this effect runs.
 */
export const effect: Synapse['createEffect'] = (fn, patchTarget) =>
  useSynapse().createEffect(fn, patchTarget);

/**
 * Create an effect that runs when the value of signals in the function are
 * changed.
 *
 * Automatically queues a patch to the menu's message embeds when the effect
 * is run.
 * @param fn The effect to run.
 * @param params Extra configuration for debugging.
 */
export const embedEffect: Synapse['createEmbedEffect'] = (fn) =>
  useSynapse().createEmbedEffect(fn);

/**
 * Create an effect that runs when the value of signals in the function are
 * changed.
 *
 * Automatically queues a patch to the menu's message components when the
 * effect is run.
 * @param fn The effect to run.
 * @param params Extra configuration for debugging.
 */
export const componentEffect: Synapse['createComponentEffect'] = (fn) =>
  useSynapse().createComponentEffect(fn);

// Component

/**
 * Configures an interactive message component.
 *
 * - Passed component id is auto-formatted to `menuId:viewId:componentId`.
 *   - `viewId:viewId:componentId` if standalone.
 * - Calls the passed component builder's `setCustomId` with the provided id.
 * - Binds a given handler to a component via its id.
 * @returns The provided component builder.
 */
export const component: Synapse['component'] = (definition) =>
  useSynapse().component(definition);

// Navigation

/**
 * Instantiate and navigate to a different view.
 *
 * - Can navigate back out of the view using {@link goBack}
 */
export const goTo: Synapse['goTo'] = (view, props) =>
  useSynapse().goTo(view, props);

/**
 * Navigate back to the calling view.
 *
 * @throws If not navigated to using {@link goTo}
 */
export const goBack: Synapse['goBack'] = () => useSynapse().goBack();

/**
 * Returns true if this view was navigated to using {@link goTo}. Safely allows
 * the use of {@link goBack} since the previous menu is on the navigation stack.
 */
export const canNavigateBack: Synapse['canGoBack'] = () =>
  useSynapse().canGoBack();

// Modals

export const showModal: Synapse['showModal'] = (interaction, modalOrOptions) =>
  useSynapse().showModal(
    interaction,
    modalOrOptions as Parameters<Synapse['showModal']>[1],
  );

export const awaitModalSubmit: Synapse['awaitModalSubmit'] = (
  interaction,
  options,
) => useSynapse().awaitModalSubmit(interaction, options);

export const onModalSubmit: Synapse['onModalSubmit'] = (
  interaction,
  options,
  callback,
) => useSynapse().onModalSubmit(interaction, options, callback);

// Embed manipulation

export const queueEmbeds: Synapse['appendEmbeds'] = (...embeds) =>
  useSynapse().appendEmbeds(...embeds);

export const queueEmbedsAtHead: Synapse['prependEmbeds'] = (...embeds) =>
  useSynapse().prependEmbeds(...embeds);

// Menu manipulation

export const setIdleMs: Synapse['setIdleMs'] = (idleMilliseconds) =>
  useSynapse().setIdleMs(idleMilliseconds);

export const setIdleSec: Synapse['setIdleSec'] = (idleSeconds) =>
  useSynapse().setIdleSec(idleSeconds);

export const closeMenu: Synapse['close'] = () => useSynapse().close();

export const stopMenu: Synapse['stop'] = (reason) => useSynapse().stop(reason);

// Rendering

/**
 * Manually queue patches for specific message parts.
 */
export const patch: Synapse['patch'] = (...targets) =>
  useSynapse().patch(...targets);
