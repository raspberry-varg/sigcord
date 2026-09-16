import { useContext } from '../../lib/contexts/useContext.js';
import { CordContext } from '../cordContext.js';
import { getCurrentSynapse } from '../../lib/builtins/builtins.js';
import type { RepliableInteraction } from 'discord.js';

export function deferUpdate(interaction?: RepliableInteraction): void {
  const cord = useContext(CordContext);
  if (!cord) {
    // Fallback to legacy behavior.
    getCurrentSynapse().deferUpdate(interaction);
    return;
  }
  cord.deferUpdate(interaction);
}
