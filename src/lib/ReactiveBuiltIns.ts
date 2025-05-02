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
import {
  createUntracked,
  isWritableSignal,
  type EffectFn,
  type Resource,
  type ResourceTuple,
  type Signalish,
} from './Reactivity.js';
import type { DisposeFn } from './render/dispose.js';
import { getOpenOwnerStrict } from './render/owner.js';
import type { ReactiveViewPayloadV1 } from './MenuView.js';

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

export function setReactiveContext(synapse: Synapse | null) {
  currentSynapse = synapse;
}

// - - - - - - -
// Begin globals
// - - - - - - -

// Signals

/**
 * Create a new signal.
 *
 * Signals are functions that allow for fine-grained reactivity in an app,
 * triggering reactions ("effects") **only if** their value changes.
 *
 * ```ts
 * const [clicks, setClicks] = signal(0);
 * const button = createDiscordButton();
 * componentEffect(() => {
 *   // subscribes to this signal and re-runs any time this signal changes
 *   button.label = `You have clicked me ${clicks()} times.`;
 * });
 *
 * return component({
 *   id: 'my-component',
 *   controller: (buttonInteraction) => {
 *     // updates clicks without reading the signal
 *     setClicks((prev) => prev + 1);
 *   }
 * });
 * ```
 *
 * In DIM, signals automatically bind to the render cycle. If you need to
 * completely re-run an entire function if any subscribed signal changes, or to
 * incrementally migrate a component to be fully reactive, wrap the embed or
 * component in a closure:
 *
 * ```ts
 * const [clicks, setClicks] = signal(0);
 * return {
 *   embeds: [
 *     () =>
 *       new EmbedBuilder()
 *         .setDescription(`You clicked the button below ${clicks()} times!`),
 *   ],
 *   components: [
 *     // ...
 *   ]
 * }
 * ```
 *
 * @param initialValue The initial value to set to the signal. Omit to assign
 *    later.
 * @returns Signal tuple with a signal getter and setter.
 */
export const signal: Synapse['createSignal'] = <T>(
  initialValue: T | undefined = undefined,
) => useSynapse().createSignal(initialValue);

/**
 * Create an object to modify and read from a single signal. Capable of being
 * split into a signal tuple or standalone signal.
 * @param initialValue The initial value to set to the signal. Omit to assign
 *    later.
 * @returns Object containing signal read and mutators.
 */
export const writable: Synapse['createWritableSignal'] = <T>(
  initialValue: T | undefined = undefined,
) => useSynapse().createWritableSignal(initialValue);

/**
 * Create a signal that only updates if any of its dependencies change.
 * @param derived Function with signal reads.
 * @returns Signal that has subscribed to any signals read during its initial
 *    call.
 */
export const computed: Synapse['createComputed'] = <T>(derived: () => T) =>
  useSynapse().createComputed(derived);

/**
 * Read a signal or callback of signals without subscribing it to the current
 * reactive context or effect.
 * @param signalOrFn Signal to read from or a function reading signals.
 */
export function untracked<T>(signalOrFn: Signalish<T> | (() => T)): T {
  if (isWritableSignal(signalOrFn)) {
    signalOrFn = signalOrFn.readonly();
  }
  return createUntracked(signalOrFn);
}

/**
 * Create a computed signal that auto-populates with the resolved value from the
 * provided asynchronous task.
 *
 * ```ts
 * const [user, mutateUser, refreshUser] = resource(() => fetchUserDb());
 * const embed = createEmbed().setTitle('User Info');
 * componentEffect(() => {
 *   if (user.isLoading()) {
 *     embed.setDescription('Loading...');
 *   }
 *   const u = user();
 *   embed.setDescription(`Viewing information for ${u.name}.`);
 *   // ...
 * });
 * return {
 *   embeds: [embed],
 * };
 * ```
 *
 * @param getResource Getter function that resolves to the wanted resource kind.
 * @returns Tuple with a resource, mutator for optimistic updates, and a refresh
 * function that reruns the provided task.
 */
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
  assert(
    target != null && target !== PatchTarget.None,
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
  boundaryFn: () => Promise<T>,
): Promise<T> {
  const resume = suspend();
  const result = await boundaryFn();
  resume();
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
