import type { RepliableInteraction } from 'discord.js';

export interface SigcordConfig {
  /**
   * How long before a menu expires in milliseconds.
   *
   * Defaults to 14 minutes, right below the 15-minute timeout Discord has for
   * interactions.
   */
  defaultIdleTimeoutMs: number;

  /**
   * Called when an interaction is received for a menu that has expired.
   */
  onDeadInteraction?: (interaction: RepliableInteraction) => void;

  /**
   * Support Bun's --hot reloading (globalThis persistence of objects such as
   * the router).
   */
  supportHotReloading: boolean;
}

const globalConfig: SigcordConfig = {
  defaultIdleTimeoutMs: 14 * 60 * 1000,
  onDeadInteraction: undefined,
  supportHotReloading: false,
};

export function configure(options: Partial<SigcordConfig>): void {
  Object.assign(globalConfig, options);
}

export function getConfig() {
  return globalConfig;
}
