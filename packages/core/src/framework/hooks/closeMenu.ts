import { getCurrentSynapseOrDefault } from '../../lib/builtins/currentSynapse.js';
import { useCordInternalOrThrow } from '../cordContext.js';

export const closeMenu = () => {
  const legacy = getCurrentSynapseOrDefault();
  if (legacy) {
    return legacy.close();
  }

  const cord = useCordInternalOrThrow();
  return cord.close();
};
