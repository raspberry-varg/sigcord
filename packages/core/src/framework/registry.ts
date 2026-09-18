import { getConfig } from '../config.js';
import type { Cord } from './cord.js';
import { coreLog } from '../internal/coreLog.js';

declare global {
  var hmr__sigcord_activeCords: Map<string, Cord> | undefined;
}

const isDev = process.env.NODE_ENV === 'development';

type Registry = Map<string, Cord>;

let registry: Registry;
export function getActiveCords(): Registry {
  // Lazy to allow the end-user to configure if they want HMR support.
  if (registry) return registry;

  const hmr = isDev && getConfig().supportHotReloading;

  registry =
    (hmr && globalThis.hmr__sigcord_activeCords) || new Map<string, Cord>();

  if (hmr) {
    if (globalThis.hmr__sigcord_activeCords) {
      coreLog.info('HMR Cord registry restored.', {
        registrySize: globalThis.hmr__sigcord_activeCords.size,
      });
    } else {
      coreLog.info('Initialized HMR Cord registry.');
      globalThis.hmr__sigcord_activeCords = registry;
    }
  }

  return registry;
}
