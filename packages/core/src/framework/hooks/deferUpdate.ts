import { getCurrentSynapseOrDefault } from '../../lib/builtins/currentSynapse.js';
import { useCordInternalOrThrow } from '../cordContext.js';

import type { RepliableInteraction } from 'discord.js';

/**
 * Defer an update if the provided interaction is a
 * {@link import('discord.js').MessageComponentInteraction}. If no interaction is provided, it will
 * attempt to defer update of the latest interaction collected.
 *
 * If update deferral is possible, no scheduled updates to the interaction will
 * occur until the deferral is complete.
 *
 * Has no effect if already deferring with another call to this function.
 *
 * @example
 * ```ts
 * component({
 *   id: 'foo',
 *   handler: () => {
 *     // Implicitly defers this interaction as it was the last collected.
 *     deferUpdate();
 *   }
 * });
 *
 * component({
 *   id: 'foo',
 *   handler: (interaction) => {
 *     deferUpdate(interaction);
 *   }
 * });
 * ```
 *
 * @param interaction
 */
export function deferUpdate(interaction?: RepliableInteraction): void {
  const legacy = getCurrentSynapseOrDefault();
  if (legacy) {
    legacy.deferUpdate(interaction);
    return;
  }
  const cord = useCordInternalOrThrow();
  cord.deferUpdate(interaction);
}
