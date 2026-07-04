import { bold, ContainerBuilder, EmbedBuilder } from 'discord.js';

const TIMEOUT_MESSAGE = `⏰ ${bold('Menu has timed out due to inactivity.')}`;

export const TimeoutEmbed = new EmbedBuilder({
  description: TIMEOUT_MESSAGE,
});

export const TimeoutComponent = new ContainerBuilder().addTextDisplayComponents(
  (textDisplay) => textDisplay.setContent(TIMEOUT_MESSAGE),
);
