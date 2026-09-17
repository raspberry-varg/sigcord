import type { Interaction } from 'discord.js';
import { getActiveCords } from './registry.js';

/**
 * Attempts to route an incoming interaction to the appropriate {@link Cord} if
 * one exists for the interaction's message.
 *
 * @param interaction
 *
 * @returns Whether the interaction was routed to a {@link Cord}.
 */
export async function routeInteraction(
  interaction: Interaction,
): Promise<boolean> {
  if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) {
    return false;
  }

  const messageId = interaction.message?.id;
  if (!messageId) {
    return false;
  }

  const cord = getActiveCords().get(messageId);
  if (!cord) {
    return false;
  }

  await cord.handleInteraction(interaction);
  return true;
}
