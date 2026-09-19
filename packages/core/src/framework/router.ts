import type {Interaction} from 'discord.js';

import {coreLog} from '../internal/coreLog.js';
import {getActiveCords} from './registry.js';

const nsLogger = coreLog.namespaced('router');

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
    nsLogger.info('Received interaction with no component or modal');
    return false;
  }

  const messageId = interaction.message?.id;
  if (!messageId) {
    nsLogger.warn('Received interaction with no message id');
    return false;
  }

  const cord = getActiveCords().get(messageId);
  if (!cord) {
    nsLogger.warn(`No Cord for message id ${messageId}`);
    return false;
  }

  nsLogger.debug(`Routing interaction to Cord for message id ${messageId}`);
  await cord.handleInteraction(interaction);
  nsLogger.debug(`Interaction routed to Cord for message id ${messageId}`);
  return true;
}
