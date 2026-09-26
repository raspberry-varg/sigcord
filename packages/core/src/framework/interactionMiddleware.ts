import { type RepliableInteraction } from 'discord.js';

export type InteractionMiddleware = (
  interaction: RepliableInteraction,
  next: () => Promise<void>,
) => void | Promise<void>;
