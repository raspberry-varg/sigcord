import { getConfig } from '../../config.js';
import { StaticCord } from '../../framework/staticCord.js';
import { StaticCordContext } from '../../framework/staticCordContext.js';
import { provideContextValue } from '../contexts/provideContext.js';
import { SynapseContext } from '../menu/instance/synapse.js';
import { createRootOwner, runWithOwner } from '../owners/owner.js';
import { untracked } from '../reactivity/untracked.js';

import { flatten } from './flatten.js';
import { STATIC_RENDER_SYNAPSE } from './staticRenderSynapse.js';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Render a set of DIM-compatible reactive function components to a flattened
 * result. Dispose is called before the method is returned.
 *
 * @param renderFn
 * @returns
 */
export function staticRender<T>(renderFn: () => unknown): T[] {
  const rootOwner = createRootOwner();
  const result = runWithOwner(rootOwner, () => {
    if (getConfig().useCordFactoriesForLegacyViewDefines) {
      provideContextValue(SynapseContext, STATIC_RENDER_SYNAPSE);
    } else {
      provideContextValue(StaticCordContext, new StaticCord());
    }
    const out = untracked(renderFn);
    const flattened = flatten(out, isDev ? 'StaticRoot' : undefined);
    return Array.isArray(flattened) ? flattened : [flattened];
  });
  rootOwner.dispose();
  return result as T[];
}
