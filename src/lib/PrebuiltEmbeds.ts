import { EmbedBuilder } from 'discord.js';
import { endReasonIsTimeout } from '../util/CollectorUtil';

export function TimeoutEmbed(endReason?: string | null) {
  return new EmbedBuilder({
    description: endReasonIsTimeout(endReason)
      ? '⏰ **This Menu has timed out.**'
      : '🏞️ **This menu has been successfully closed.**',
  });
}
