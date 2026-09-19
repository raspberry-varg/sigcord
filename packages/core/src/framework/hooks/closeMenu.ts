import { getCurrentSynapse } from '../../lib/builtins/currentSynapse.js';
import { useCordInternal } from '../cordContext.js';

export const closeMenu = () => {
  const cord = useCordInternal();
  if (!cord) {
    // Legacy behavior
    return getCurrentSynapse().close();
  }
  return cord.close();
};
