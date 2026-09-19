import {useContext} from '../../lib/contexts/useContext.js';
import {PatchTarget} from '../patchTarget.js';

export const PatchTargetContext = {
  id: Symbol('__sigcord.PatchTargetContext'),
  default: PatchTarget.None,
};

/**
 * Returns the current target this owner tree should request a patch for.
 */
export function usePatchTarget(): PatchTarget {
  return useContext(PatchTargetContext);
}
