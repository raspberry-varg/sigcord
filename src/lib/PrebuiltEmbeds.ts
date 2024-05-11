import { EmbedBuilder } from 'discord.js';
import { endReasonIsTimeoutOrClose } from '../util/CollectorUtil';

export function TimeoutEmbed(endReason?: string | null) {
  return new EmbedBuilder({
    description: endReasonIsTimeoutOrClose(endReason)
      ? '⏰ **This Menu has timed out.**'
      : '🏞️ **This menu has been successfully closed.**',
  });
}
