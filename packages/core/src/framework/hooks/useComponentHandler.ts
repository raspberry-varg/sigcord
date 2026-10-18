import { type CollectedInteraction } from 'discord.js';

import { useCordInternalOrThrow } from '../cordContext.js';
import { inStaticCord } from '../staticCordContext.js';

import type { DisposeFn } from '../../lib/render/dispose.js';

const noop = () => {};

/**
 * Manually maps a custom id to a callback to execute when a component with that
 * id is interacted with.
 *
 * @param customId The custom id to listen for.
 * @param handler The callback to execute when the component is interacted with.
 */
export function useComponentHandler(
  customId: string,
  handler: (interaction: CollectedInteraction) => unknown | Promise<unknown>,
): DisposeFn {
  if (inStaticCord()) {
    return noop;
  }

  const cord = useCordInternalOrThrow();
  return cord.registerComponent(customId, handler);
}
