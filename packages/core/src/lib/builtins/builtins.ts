/**
 * This module is a collection of legacy ambient functions that are used in reactive views. Most have
 * shims to support the upcoming rendering engine overhaul using "Cord" instances over the monolithic
 * menu instance class.
 */
import { type CollectedMessageInteraction, type RepliableInteraction } from 'discord.js';

import { ComponentsV1ImperativeAPIContext } from '../../core/contexts/componentsV1ImperativeAPIContext.js';
import { useCordInternal } from '../../framework/cordContext.js';
import {
  createUniqueComponentId,
  markDirty,
  useMenuInfo,
  useNavigation,
} from '../../framework/hooks/index.js';
import { usePatchTarget } from '../../framework/hooks/usePatchTarget.js';
import { PatchTarget } from '../../framework/patchTarget.js';
import { coreLog } from '../../internal/coreLog.js';
import { useContext } from '../contexts/useContext.js';
import { Synapse } from '../menu/instance/synapse.js';

import { getCurrentSynapse } from './currentSynapse.js';

// Signal effects

/**
 * @deprecated Please use {@link usePatchTarget}.
 */
export function getCurrentPatchTarget(): PatchTarget | undefined {
  return usePatchTarget();
}

/**
 * @deprecated In handlers, please use {@link import('@sigcord/core').useRepliable}.
 */
export function injectLastCollectedInteraction(): CollectedMessageInteraction | undefined {
  return useMenuInfo().lastCollectedInteraction;
}

/**
 * @deprecated In handlers, please use {@link import('@sigcord/core').useRepliable}.
 */
export function injectCurrentInteraction(): RepliableInteraction {
  return useMenuInfo().interaction;
}

// Component

/**
 * @deprecated Please use {@link createUniqueComponentId}.
 */
export const getNextUniqueComponentId: Synapse['getNextUniqueComponentId'] = () =>
  createUniqueComponentId();

// Navigation

/**
 * Instantiate and navigate to a different view.
 *
 * - Can navigate back out of the view using {@link goBack}
 */
export const goTo: Synapse['goTo'] = (view, props) => {
  const cord = useCordInternal();
  if (cord) {
    coreLog.warn('goTo is deprecated in Cord. Please use useNavigation().push()');
    const nav = useNavigation();
    nav.push(() => (view as any)(props));
    return;
  }
  getCurrentSynapse().goTo(view, props);
};

/**
 * Navigate back to the calling view.
 *
 * @throws If not navigated to using {@link goTo}
 */
export const goBack: Synapse['goBack'] = () => {
  const cord = useCordInternal();
  if (cord) {
    coreLog.warn('goBack is deprecated in Cord. Please use useNavigation().pop()');
    const nav = useNavigation();
    nav.pop();
    return;
  }
  getCurrentSynapse().goBack();
};

/**
 * Returns true if this view was navigated to using {@link goTo}. Safely allows
 * the use of {@link goBack} since the previous menu is on the navigation stack.
 */
export const canNavigateBack: Synapse['canGoBack'] = () => {
  const cord = useCordInternal();
  if (cord) {
    coreLog.warn('canNavigateBack is deprecated in Cord. Please use useNavigation().canGoBack()');
    const nav = useNavigation();
    return nav.canGoBack();
  }
  return getCurrentSynapse().canGoBack();
};

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
 * @deprecated Use {@link awaitModal}
 * @param interaction
 * @param options
 */
export const awaitModalSubmit: Synapse['awaitModalSubmit'] = (interaction, options) =>
  getCurrentSynapse().awaitModalSubmit(interaction, options);

/**
 * @deprecated Use {@link awaitModal}
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
export const queueEmbeds: Synapse['appendEmbeds'] = (...embeds) => {
  const cord = useCordInternal();
  if (cord) {
    const imperativeAPI = useContext(ComponentsV1ImperativeAPIContext);
    if (!imperativeAPI) {
      throw new Error('ComponentsV1ImperativeAPIContext is not available. Did you use mountV1?');
    }
    imperativeAPI.queueEmbeds(...embeds);
    return;
  }
  getCurrentSynapse().appendEmbeds(...embeds);
};

/**
 * @deprecated Please use contexts with signals instead.
 */
export const queueEmbedsAtHead: Synapse['prependEmbeds'] = (...embeds) => {
  const cord = useCordInternal();
  if (cord) {
    const imperativeAPI = useContext(ComponentsV1ImperativeAPIContext);
    if (!imperativeAPI) {
      throw new Error('ComponentsV1ImperativeAPIContext is not available. Did you use mountV1?');
    }
    imperativeAPI.prependEmbeds(...embeds);
    return;
  }
  getCurrentSynapse().prependEmbeds(...embeds);
};

/**
 * @deprecated Please use contexts with signals instead.
 */
export const queueComponents: Synapse['appendComponents'] = (...components) => {
  const cord = useCordInternal();
  if (cord) {
    const imperativeAPI = useContext(ComponentsV1ImperativeAPIContext);
    if (!imperativeAPI) {
      throw new Error('ComponentsV1ImperativeAPIContext is not available. Did you use mountV1?');
    }
    imperativeAPI.queueComponents(...components);
    return;
  }
  getCurrentSynapse().appendComponents(...components);
};

/**
 * @deprecated Please use contexts with signals instead.
 */
export const queueComponentsAtHead: Synapse['prependComponents'] = (...components) => {
  const cord = useCordInternal();
  if (cord) {
    const imperativeAPI = useContext(ComponentsV1ImperativeAPIContext);
    if (!imperativeAPI) {
      throw new Error('ComponentsV1ImperativeAPIContext is not available. Did you use mountV1?');
    }
    imperativeAPI.prependComponents(...components);
    return;
  }
  getCurrentSynapse().prependComponents(...components);
};

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

// Rendering

/**
 * @deprecated Use {@link markDirty} instead.
 *
 * Manually queue patches for specific message parts.
 */
export const patch: Synapse['addPatchTargets'] = (...targets) => {
  let target = 0;
  for (let i = 0; i < targets.length; i++) {
    target |= targets[i];
  }
  if (target !== 0) {
    markDirty(target);
  }
};
