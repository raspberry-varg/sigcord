import { CollectedInteraction } from 'discord.js';

export type InteractionMiddleware = (
  interaction: CollectedInteraction,
  next: () => Promise<void>,
) => void | Promise<void>;
