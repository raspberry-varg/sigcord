import { useCordInternal } from '../../framework/cordContext.js';
import { Synapse } from '../menu/instance/synapse.js';

import { getCurrentSynapse } from './currentSynapse.js';

/**
 * @deprecated Use {@link awaitModal}.
 *
 * @param interaction
 * @param modalOrOptions
 */
export const showModal: Synapse['showModal'] = (interaction, modalOrOptions) => {
  const cord = useCordInternal();
  if (cord) {
    throw new Error('showModal is not supported in Cord. Please use awaitModal instead.');
  }
  return getCurrentSynapse().showModal(
    interaction,
    modalOrOptions as Parameters<Synapse['showModal']>[1],
  );
};
