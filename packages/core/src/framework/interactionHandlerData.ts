import {CollectedInteraction, type ModalSubmitInteraction} from 'discord.js';

import type {Owner} from '../lib/owners/owner.js';

interface InteractionHandlerData {
  handle: unknown | Promise<unknown>;
  owner: Owner | null;
}

export interface CollectedInteractionHandlerData extends InteractionHandlerData {
  /**
   * @param interaction The received component interaction.
   */
  handle(interaction: CollectedInteraction): unknown | Promise<unknown>;
}

export interface ModalInteractionHandlerData extends InteractionHandlerData {
  /**
   * @param interaction The received modal interaction.
   */
  handle(interaction: ModalSubmitInteraction): unknown | Promise<unknown>;
}
