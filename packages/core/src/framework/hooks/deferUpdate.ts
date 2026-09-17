import { useContext } from '../../lib/contexts/useContext.js';
import { CordContext } from '../cordContext.js';
import { getCurrentSynapse } from '../../lib/builtins/builtins.js';
import type {
  RepliableInteraction,
  MessageComponentInteraction,
} from 'discord.js';

/**
 * Defer an update if the provided interaction is a
 * {@link MessageComponentInteraction}. If no interaction is provided, it will
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
  const cord = useContext(CordContext);
  if (!cord) {
    // Fallback to legacy behavior.
    getCurrentSynapse().deferUpdate(interaction);
    return;
  }
  cord.deferUpdate(interaction);
}
