import { routeInteraction } from './router.js';

import type { Interaction } from 'discord.js';

type SigcordMiddleware = (interaction: Interaction, next: () => Promise<void>) => Promise<void>;

/**
 * Creates a middleware function that routes interactions to their respective handlers.
 */
export function createSigcordMiddleware(): SigcordMiddleware {
  return async (interaction, next) => {
    if (!(await routeInteraction(interaction))) {
      return await next();
    }
  };
}
