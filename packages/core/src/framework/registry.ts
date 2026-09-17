import { getConfig } from '../config.js';
import type { Cord } from './cord.js';

declare global {
  var hmr__sigcord_activeCords: Map<string, Cord> | undefined;
}

const isDev = process.env.NODE_ENV === 'development';

type Registry = Map<string, Cord>;

let registry: Registry;
export function getActiveCords(): Registry {
  // Lazy to allow the end-user to configure if they want HMR support.
  if (registry) return registry;

  registry =
    (isDev &&
      getConfig().supportHotReloading &&
      globalThis.hmr__sigcord_activeCords) ||
    new Map<string, Cord>();

  if (isDev && getConfig().supportHotReloading) {
    globalThis.hmr__sigcord_activeCords = registry;
  }

  return registry;
}
