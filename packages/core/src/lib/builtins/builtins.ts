/**
 * This module contains built-ins that can be used in a reactive view, removing
 * the need to drill a `$` synapse prop to reactive components or nested
 * reactive views.
 */
import { type CollectedMessageInteraction, type RepliableInteraction } from 'discord.js';

import { createUniqueComponentId } from '../../framework/hooks/index.js';
import { usePatchTarget } from '../../framework/hooks/usePatchTarget.js';
import { PatchTarget } from '../../framework/patchTarget.js';
import { Synapse } from '../menu/instance/synapse.js';
import { getOwner } from '../owners/owner.js';

import type { MenuContext } from '../menu/instance/menuContext.js';

export const SYNAPSE_CONTEXT_ID = Symbol.for('__sigcord.Synapse');

export function getCurrentSynapse(): Synapse {
  const synapse = getCurrentSynapseOrDefault();
  if (!synapse) {
    throw new Error(
      'Attempted to use a hook outside of a reactive context. Was this called ' +
        'outside of a reactive view?\n\nClassic menu views should use the ' +
        'Synapse parameter directly ($).\n\n' +
        'Did you await within the body of a component function?',
    );
  }
  return synapse;
}

export function getCurrentSynapseOrDefault(): Synapse | undefined {
  const owner = getOwner();
  return owner?.context[SYNAPSE_CONTEXT_ID] as Synapse | undefined;
}

/**
 * Get info and state about the current menu.
 */
export function useMenuInfo(): Readonly<MenuContext> {
  return getCurrentSynapse().getMenuInfo();
}

// Signal effects

/**
 * @deprecated Will be replaced with {@link usePatchTarget}.
 */
export function getCurrentPatchTarget(): PatchTarget | undefined {
  return usePatchTarget();
}

/**
 * @deprecated Will be replaced with a context of some sort.
 */
export function injectLastCollectedInteraction(): CollectedMessageInteraction | undefined {
  return useMenuInfo().lastCollectedInteraction;
}

/**
 * @deprecated Will be replaced with a context of some sort.
 */
export function injectCurrentInteraction(): RepliableInteraction {
  return useMenuInfo().interaction;
}

// Component

export const getNextUniqueComponentId: Synapse['getNextUniqueComponentId'] = () =>
  createUniqueComponentId();

// Navigation

/**
 * Instantiate and navigate to a different view.
 *
 * - Can navigate back out of the view using {@link goBack}
 */
export const goTo: Synapse['goTo'] = (view, props) => getCurrentSynapse().goTo(view, props);

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
export const canNavigateBack: Synapse['canGoBack'] = () => getCurrentSynapse().canGoBack();

/**
 * Perform an action when this reactive view is navigated away from.
 *
 * @param action Action to perform when this view suspends.
 */
export const onSuspend: Synapse['onSuspend'] = (action) => getCurrentSynapse().onSuspend(action);

/**
 * Perform an action when this reactive view is navigated back to.
 *
 * @param action Action to perform when this menu is navigated back to.
 */
export const onResume: Synapse['onResume'] = (action) => getCurrentSynapse().onResume(action);

// Modals

/**
 * @deprecated Use {@link awaitModalSubmit}.
 * @param interaction
 * @param modalOrOptions
 */
export const showModal: Synapse['showModal'] = (interaction, modalOrOptions) =>
  getCurrentSynapse().showModal(interaction, modalOrOptions as Parameters<Synapse['showModal']>[1]);

/**
 * @deprecated Use {@link awaitModalSubmit}
 * @param interaction
 * @param options
 */
export const awaitModalSubmit: Synapse['awaitModalSubmit'] = (interaction, options) =>
  getCurrentSynapse().awaitModalSubmit(interaction, options);

/**
 * @deprecated Use {@link awaitModalSubmit}
 * @param interaction
 * @param options
 * @param callback
 */
export const onModalSubmit: Synapse['onModalSubmit'] = (interaction, options, callback) =>
  getCurrentSynapse().onModalSubmit(interaction, options, callback);

// Embed manipulation

/**
 * @deprecated Please use contexts with signals instead.
 */
export const queueEmbeds: Synapse['appendEmbeds'] = (...embeds) =>
  getCurrentSynapse().appendEmbeds(...embeds);

/**
 * @deprecated Please use contexts with signals instead.
 */
export const queueEmbedsAtHead: Synapse['prependEmbeds'] = (...embeds) =>
  getCurrentSynapse().prependEmbeds(...embeds);

/**
 * @deprecated Please use contexts with signals instead.
 */
export const queueComponents: Synapse['appendComponents'] = (...components) =>
  getCurrentSynapse().appendComponents(...components);

/**
 * @deprecated Please use contexts with signals instead.
 */
export const queueComponentsAtHead: Synapse['prependComponents'] = (...components) =>
  getCurrentSynapse().prependComponents(...components);

// Menu manipulation

/**
 * @deprecated Will be removed when legacy view definitions go away.
 */
export const setIdleMs: Synapse['setIdleMs'] = (idleMilliseconds) =>
  getCurrentSynapse().setIdleMs(idleMilliseconds);

/**
 * @deprecated Will be removed when legacy view definitions go away.
 */
export const setIdleSec: Synapse['setIdleSec'] = (idleSeconds) =>
  getCurrentSynapse().setIdleSec(idleSeconds);

/**
 * @deprecated Use {@link close} instead.
 * @param reason
 */
export const stopMenu: Synapse['stop'] = (reason) => getCurrentSynapse().stop(reason);

// Rendering

/**
 * @deprecated Use {@link markDirty} instead.
 *
 * Manually queue patches for specific message parts.
 */
export const patch: Synapse['addPatchTargets'] = (...targets) =>
  getCurrentSynapse().addPatchTargets(...targets);
