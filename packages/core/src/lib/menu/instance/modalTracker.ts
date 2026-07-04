import type { ModalRepliableInteraction } from '../../interactivity/modalHandling.js';
import type { ModalBuilder } from 'discord.js';

export class ModalTracker {
  private latestInteractionId = '';
  private latestCustomId = '';

  setModal(modal: ModalBuilder): void {
    this.latestCustomId = modal.data.custom_id ?? '';
  }

  setInteraction(interaction: ModalRepliableInteraction): void {
    this.latestInteractionId = interaction.id;
  }

  flush(): void {
    this.latestInteractionId = '';
    this.latestCustomId = '';
  }

  isCustomId(id: string): boolean {
    return id === this.latestCustomId;
  }

  isInteractionId(id: string): boolean {
    return id === this.latestInteractionId;
  }
}
