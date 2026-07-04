/**
 * This module contains built-ins that can be used in a reactive view, removing
 * the need to drill a `$` synapse prop to reactive components or nested
 * reactive views.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { Synapse } from '../menu/instance/synapse.js';
import { PatchTarget } from '../RenderingEngine.js';
import { assert } from '../../util/Assertions.js';
import type { EffectFn } from '../reactivity/core/signals.js';
import type { DisposeFn } from '../render/dispose.js';
import { getOpenOwnerStrict } from '../render/owner.js';
import type { MaybePromise } from '../../util/TypesUtil.js';
import type { MenuContext } from '../menu/instance/menuContext.js';
import { STATIC_RENDER_SYNAPSE } from '../render/staticRenderSynapse.js';
import {
  type CollectedMessageInteraction,
  type RepliableInteraction,
  type MessageComponentInteraction,
} from 'discord.js';

let currentSynapse: Synapse | null = null;

const asyncLocalStorage = new AsyncLocalStorage<Synapse>();

export function getAsyncStore(): AsyncLocalStorage<Synapse> {
  return asyncLocalStorage;
}

export function getCurrentSynapse(): Synapse {
  const instance = asyncLocalStorage.getStore() ?? currentSynapse;
  assert(
    instance,
    'Attempted to use a hook outside of a reactive context. Was this called ' +
      'outside of a reactive view?\n\nClassic menu views should use the ' +
      'Synapse parameter directly ($).\n\n' +
      'Did you await within the body of a component function?',
  );
  return instance;
}

/**
 * Replace the current active reactive context.
 *
 * @param instance The new active context.
 * @returns The previous context.
 */
export function setCurrentSynapse(instance: Synapse | null): Synapse | null {
  const prev = currentSynapse;
  currentSynapse = instance;
  if (instance) {
    asyncLocalStorage.enterWith(instance);
  } else {
    asyncLocalStorage.disable();
  }
  return prev;
}

/**
 * Get info and state about the current menu.
 */
export function useMenuInfo(): Readonly<MenuContext> {
  return getCurrentSynapse().getMenuInfo();
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
  getCurrentSynapse().createEffect(fn, patchTarget);

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
  const target = getCurrentPatchTarget();
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

export function getCurrentPatchTarget(): PatchTarget | undefined {
  return getOpenOwnerStrict().patchTarget;
}

// Asynchronous escape-hatches

/**
 * Resumes a reactive hook context to the value before an `await` expression.
 */
type ResumeCtxFn = () => void;

/**
 * __Here be dragons__ _(see {@link asyncBoundary})_.
 *
 * Suspend the current reactive hook context. Returns a function to resume the
 * context.
 *
 * @returns Function to resume the current reactive hook context, allowing hooks
 *   to continue to be used after an `await`.
 */
export function suspend(): ResumeCtxFn {
  const capturedContext = getCurrentSynapse();
  assert(
    capturedContext,
    'Attempted to suspend the current reactive context, but none was found. ' +
      'Did you forget to use the returned resume() function from a previous ' +
      'call to suspend()? If in an async boundary, nested awaits must also ' +
      'be pulled into their own async boundary.',
  );
  return function resumeSuspendedContext() {
    setCurrentSynapse(capturedContext);
  };
}

/**
 * @deprecated
 * Please use synchronous alternatives to handle typically-async tasks.
 * *   {@link deferUpdate} Asynchronously calls `deferUpdate` if necessary. When
 *     it comes time to update the menu, the interaction patcher waits until the
 *     tracked `deferUpdate` is resolved.
 * *   {@link resource} Signal with asynchronous fetching of data. All automatic
 *     updates (and manual {@link update} calls) are queued into a single
 *     microtask.
 *
 * @summary
 * Perform an asynchronous action within a component handler. The reactive hook
 * context will be automatically suspended and resumed when {@link fnOrPromise}
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
 * @returns Promise which resets the current reactive context when the provided
 *    action's promise resolves.
 */
export async function asyncBoundary<T>(
  fnOrPromise: MaybePromise<T> | (() => MaybePromise<T>),
): Promise<T> {
  const resume = suspend();
  let result;
  try {
    result = await (typeof fnOrPromise === 'function'
      ? (fnOrPromise as CallableFunction)()
      : fnOrPromise);
  } finally {
    resume();
  }
  return result;
}

/**
 * Defer an update if the provided interaction is a
 * {@link MessageComponentInteraction}. If no interaction is provided, it will
 * attempt to defer update of the latest interaction collected.
 *
 * If update deferral is possible, no scheduled updates to the interaction will
 * occur until the deferral is complete.
 *
 * Has no effect if already deferring with another call to this function.
 *
 * @example
 * ```ts
 * component({
 *   id: 'foo',
 *   handler: () => {
 *     // Implicitly defers this interaction as it was the last collected.
 *     deferUpdate();
 *   }
 * });
 *
 * component({
 *   id: 'foo',
 *   handler: (interaction) => {
 *     deferUpdate(interaction);
 *   }
 * });
 * ```
 *
 * @param interaction
 */
export function deferUpdate(interaction?: RepliableInteraction): void {
  getCurrentSynapse().deferUpdate(interaction);
}

export function injectLastCollectedInteraction():
  | CollectedMessageInteraction
  | undefined {
  return useMenuInfo().lastCollectedInteraction;
}

export function injectCurrentInteraction(): RepliableInteraction {
  return useMenuInfo().interaction;
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
  getCurrentSynapse().component(definition);

export const getNextUniqueComponentId: Synapse['getNextUniqueComponentId'] =
  () => getCurrentSynapse().getNextUniqueComponentId();

// Navigation

/**
 * Instantiate and navigate to a different view.
 *
 * - Can navigate back out of the view using {@link goBack}
 */
export const goTo: Synapse['goTo'] = (view, props) =>
  getCurrentSynapse().goTo(view, props);

/**
 * Navigate back to the calling view.
 *
 * @throws If not navigated to using {@link goTo}
 */
export const goBack: Synapse['goBack'] = () => getCurrentSynapse().goBack();

/**
 * Returns true if this view was navigated to using {@link goTo}. Safely allows
 * the use of {@link goBack} since the previous menu is on the navigation stack.
 */
export const canNavigateBack: Synapse['canGoBack'] = () =>
  getCurrentSynapse().canGoBack();

/**
 * Perform an action when this reactive view is navigated away from.
 *
 * @param action Action to perform when this view suspends.
 */
export const onSuspend: Synapse['onSuspend'] = (action) =>
  getCurrentSynapse().onSuspend(action);

/**
 * Perform an action when this reactive view is navigated back to.
 *
 * @param action Action to perform when this menu is navigated back to.
 */
export const onResume: Synapse['onResume'] = (action) =>
  getCurrentSynapse().onResume(action);

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
  getCurrentSynapse().showModal(
    interaction,
    modalOrOptions as Parameters<Synapse['showModal']>[1],
  );

export const awaitModalSubmit: Synapse['awaitModalSubmit'] = (
  interaction,
  options,
) => getCurrentSynapse().awaitModalSubmit(interaction, options);

export const onModalSubmit: Synapse['onModalSubmit'] = (
  interaction,
  options,
  callback,
) => getCurrentSynapse().onModalSubmit(interaction, options, callback);

// Embed manipulation

export const queueEmbeds: Synapse['appendEmbeds'] = (...embeds) =>
  getCurrentSynapse().appendEmbeds(...embeds);

export const queueEmbedsAtHead: Synapse['prependEmbeds'] = (...embeds) =>
  getCurrentSynapse().prependEmbeds(...embeds);

export const queueComponents: Synapse['appendComponents'] = (...components) =>
  getCurrentSynapse().appendComponents(...components);

export const queueComponentsAtHead: Synapse['prependComponents'] = (
  ...components
) => getCurrentSynapse().prependComponents(...components);

// Menu manipulation

export const setIdleMs: Synapse['setIdleMs'] = (idleMilliseconds) =>
  getCurrentSynapse().setIdleMs(idleMilliseconds);

export const setIdleSec: Synapse['setIdleSec'] = (idleSeconds) =>
  getCurrentSynapse().setIdleSec(idleSeconds);

export const closeMenu: Synapse['close'] = () => getCurrentSynapse().close();

export const stopMenu: Synapse['stop'] = (reason) =>
  getCurrentSynapse().stop(reason);

// Rendering

/**
 * Manually queue patches for specific message parts.
 */
export const patch: Synapse['addPatchTargets'] = (...targets) =>
  getCurrentSynapse().addPatchTargets(...targets);

/**
 * Manually schedule an update to the current view in a microtask.
 *
 * Note: Updates are automatically scheduled after initial render and after interaction
 * handlers resolve.
 */
export const update: Synapse['scheduleUpdate'] = () => {
  return getCurrentSynapse().scheduleUpdate();
};
