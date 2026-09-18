import { createInternalContext } from './createInternalContext.js';
import type { RepliableInteraction } from 'discord.js';

export const CurrentRepliableContext =
  createInternalContext<RepliableInteraction>('CurrentRepliableContext');
