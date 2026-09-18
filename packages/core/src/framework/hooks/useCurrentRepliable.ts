import type { RepliableInteraction } from 'discord.js';
import { CurrentRepliableContext } from '../../core/contexts/currentRepliableContext.js';
import { useContext } from '../../lib/contexts/useContext.js';

/**
 * Returns the current {@link RepliableInteraction} if within an interaction handler.
 */
export function useCurrentRepliable(): RepliableInteraction | undefined {
  return useContext(CurrentRepliableContext);
}
