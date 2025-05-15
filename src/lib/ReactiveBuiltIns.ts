/**
 * This module contains built-ins that can be used in a synchronous reactive
 * view, removing the need to pass a `$` synapse prop to reactive components
 * or nested reactive views.
 *
 * `$` can still be accessed by a built-in getter for backwards-compatibility
 * with non-reactive views.
 */

import { Synapse } from './menu/synapse.js';
import { PatchTarget } from './RenderingEngine.js';
import { assert } from '../util/Assertions.js';
import type { EffectFn } from './Reactivity.js';
import type { DisposeFn } from './render/dispose.js';
import { getOpenOwnerStrict } from './render/owner.js';
import type { ReactiveViewPayloadV1 } from './MenuView.js';
import type { MaybePromise } from '../util/TypesUtil.js';
import type { MenuContext } from './menu/menuContext.js';
import { STATIC_RENDER_SYNAPSE } from './render/staticRenderSynapse.js';

let currentSynapse: Synapse | null = null;

export function useSynapse(): Synapse {
  assert(
    currentSynapse,
    'Attempted to use a hook outside of a reactive context. Was this called ' +
      'outside of a reactive view?\n\nClassic menu views should use the ' +
      'Synapse parameter directly ($).\n\n' +
      'Did you forget to use the returned resume() function from a previous ' +
      'call to suspend()? If in an async boundary, nested awaits must also ' +
      'be pulled into their own async boundary.',
  );
  return currentSynapse;
}

/**
 * Get info and state about the current menu.
 */
export function useMenuInfo(): Readonly<MenuContext> {
  return useSynapse().getMenuInfo();
}

/**
 * Replace the current active reactive context.
 *
 * @param synapse The new active context.
 * @returns The previous context.
 */
export function setReactiveContext(synapse: Synapse | null): Synapse | null {
  const prev = currentSynapse;
  currentSynapse = synapse;
  return prev;
}

// Signal effects

/**
 * Create an effect that runs when signals referenced in the effect function
 * change.
 *
 * @param fn The effect to run.
 * @param patchTarget {@link PatchTarget} bit mask to queue for rendering.
 *   Useful when mutating content objects like component or embed builders to
 *   have the change reflected to the user.
 */
export const effect: Synapse['createEffect'] = (fn, patchTarget) =>
  useSynapse().createEffect(fn, patchTarget);

/**
 * Create an effect that runs when signals referenced in the effect function
 * change. This effect will automatically request an update to the user's UI
 * based on the current rendering context.
 *
 * Useful for mutating state of content objects like component or embed builders
 * and having the change reflected to the user.
 *
 * Note: This is not required if you use a {@link computed} embed or component.
 *
 * @example
 * ```ts
 * function CountingButton() {
 *   const [clicks, setClicks] = signal(0);
 *    const button = new ButtonBuilder().setStyle(ButtonStyle.Primary);
 *    patchEffect(() => {
 *      // effect runs each time setClicks mutates the value
 *      button.setLabel(`You have clicked me ${clicks()} times.`);
 *    });
 *    // register component handler; the `button` variable is returned directly
 *    return component({
 *      component: button,
 *      handler: () => setClicks((prev) => prev + 1),
 *    });
 * }
 *
 * // components V2: anywhere within the top-level view call
 * const viewV2 = defineViewV2('my-view', () => {
 *   return [
 *     new ActionRowBuilder<ButtonBuilder>().setComponents(
 *       CountingButton(),
 *     ),
 *   ];
 * });
 *
 * // components V1: within the function passed to ReactiveViewPayloadV1#components.
 * const viewV1 = defineView('my-view', () => {
 *   return {
 *     components: () => [
 *       new ActionRowBuilder<ButtonBuilder>().setComponents(
 *         CountingButton(),
 *       ),
 *     ];
 *   };
 * });
 * ```
 *
 * @param effectFn Effect function that mutates content in the current
 *   {@link PatchTarget} context.
 */
export function patchEffect(effectFn: EffectFn): DisposeFn {
  const owner = getOpenOwnerStrict();
  const target = owner.patchTarget;
  const isValidTarget = target !== PatchTarget.None;
  assert(
    target != null &&
      (isValidTarget || currentSynapse === STATIC_RENDER_SYNAPSE),
    'patchEffect() was called outside of the embed or component render ' +
      'lifecycle. If effects that mutate content in the embed or component ' +
      'must be set up in the body of the view, use patch() with the ' +
      'appropriate PatchTarget bit mask instead.',
  );
  return effect(effectFn, target);
}

/**
 * @deprecated
 * Effect context is now dynamically-tracked as a component is rendered and
 * re-rendered. Please use {@link patchEffect} instead to have updates to embed
 * objects automatically reflected to the user.
 *
 * Components V1: If you must set up effects that mutate embed objects outside
 * of the call to {@link ReactiveViewPayloadV1.embeds}, please pass
 * {@link PatchTarget.Embeds} to the optional second parameter in
 * {@link effect}.
 *
 * @summary
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
 * @deprecated
 * Effect context is now dynamically-tracked as a component is rendered and
 * re-rendered. Please use {@link patchEffect} instead to have updates to
 * component objects automatically reflected to the user.
 *
 * Components V1: If you must set up effects that mutate embed objects outside
 * of the call to {@link ReactiveViewPayloadV1.components}, please pass
 * {@link PatchTarget.Components} to the optional second parameter in
 * {@link effect}.
 *
 * @summary
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

// Asynchronous escape-hatches

/**
 * @deprecated Use {@link asyncBoundary()} instead.
 *
 * Perform an asynchronous action, resetting the reactive context back to the
 * current menu once the action's promise resolves.
 *
 * @example
 * ```ts
 * function onClick(buttonInteraction) {
 *   const user = await resumableAction(() => fetchUserFromDb());
 *   // reactive context restored, allowing calls to context-sensitive built-ins
 *   goTo(UserInfoView, {user});
 * }
 * ```
 *
 * @param action The asynchronous action to perform immediately.
 * @returns Promise which resets the current reactive context when the provided
 *    action's promise resolves.
 */
export const resumableAction: Synapse['resumableSuspend'] = (action) =>
  useSynapse().resumableSuspend(action);

/**
 * Resumes a reactive hook context to the value before an `await` expression.
 */
type ResumeCtxFn = () => void;

/**
 * Suspend the current reactive hook context. Returns a function to resume the
 * context.
 *
 * @returns Function to resume the current reactive hook context, allowing hooks
 *   to continue to be used after an `await`.
 */
export function suspend(): ResumeCtxFn {
  const capturedContext = currentSynapse;
  assert(
    capturedContext,
    'Attempted to suspend the current reactive context, but none was found. ' +
      'Did you forget to use the returned resume() function from a previous ' +
      'call to suspend()? If in an async boundary, nested awaits must also ' +
      'be pulled into their own async boundary.',
  );
  return function resumeSuspendedContext() {
    setReactiveContext(capturedContext);
  };
}

/**
 * Perform an asynchronous action within a component handler. The reactive hook
 * context will be automatically suspended and resumed when {@link boundaryFn}
 * resolves.
 *
 * @example
 * ```ts
 * function onClick(buttonInteraction) {
 *   const user = await asyncBoundary(() => fetchUserFromDb());
 *   // reactive hook context restored, allowing hooks to safely resume their work
 *   goTo(UserInfoView, {user});
 * }
 * ```
 *
 * @param action The asynchronous action to perform immediately.
 * @returns Promise which resets the current reactive context when the provided
 *    action's promise resolves.
 */
export async function asyncBoundary<T>(
  boundaryFn: () => MaybePromise<T>,
): Promise<T> {
  const resume = suspend();
  let result;
  try {
    result = await boundaryFn();
  } finally {
    resume();
  }
  return result;
}

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

/**
 * Perform an action when this reactive view is navigated away from.
 *
 * @param action Action to perform when this view suspends.
 */
export const onSuspend: Synapse['onSuspend'] = (action) =>
  useSynapse().onSuspend(action);

/**
 * Perform an action when this reactive view is navigated back to.
 *
 * @param action Action to perform when this menu is navigated back to.
 */
export const onResume: Synapse['onResume'] = (action) =>
  useSynapse().onResume(action);

/**
 * Check if the current reactive view is suspended.
 *
 * @description
 * Views are marked as suspended when they are navigated away from with
 * {@link goTo()}.
 */
export function isSuspended(): boolean {
  return getOpenOwnerStrict().suspended;
}

// Modals

export const showModal: Synapse['showModal'] = (interaction, modalOrOptions) =>
  asyncBoundary(() =>
    useSynapse().showModal(
      interaction,
      modalOrOptions as Parameters<Synapse['showModal']>[1],
    ),
  );

export const awaitModalSubmit: Synapse['awaitModalSubmit'] = (
  interaction,
  options,
) => asyncBoundary(() => useSynapse().awaitModalSubmit(interaction, options));

export const onModalSubmit: Synapse['onModalSubmit'] = (
  interaction,
  options,
  callback,
) =>
  asyncBoundary(() =>
    useSynapse().onModalSubmit(interaction, options, callback),
  );

// Embed manipulation

export const queueEmbeds: Synapse['appendEmbeds'] = (...embeds) =>
  useSynapse().appendEmbeds(...embeds);

export const queueEmbedsAtHead: Synapse['prependEmbeds'] = (...embeds) =>
  useSynapse().prependEmbeds(...embeds);

export const queueComponents: Synapse['appendComponents'] = (...components) =>
  useSynapse().appendComponents(...components);

export const queueComponentsAtHead: Synapse['prependComponents'] = (
  ...components
) => useSynapse().prependComponents(...components);

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
