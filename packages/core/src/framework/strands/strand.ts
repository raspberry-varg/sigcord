import type { Payload } from '../payload.js';
import type { Cord } from '../cord.js';
import type {
  CollectedInteractionHandlerData,
  ModalInteractionHandlerData,
} from '../interactionHandlerData.js';
import { CollectedInteraction } from 'discord.js';

/**
 * An active view for a given {@link Cord}.
 */
export abstract class Strand {
  readonly componentHandlers = new Map<
    string,
    CollectedInteractionHandlerData
  >();
  readonly modalHandlers = new Map<string, ModalInteractionHandlerData>();

  protected constructor(protected readonly cord: Cord) {}

  abstract render(): Payload;

  destroy(): void {
    this.componentHandlers.clear();
    this.modalHandlers.clear();
  }

  suspend?(): void;
  resume?(): void;

  async executeComponentHandler(interaction: CollectedInteraction) {
    if (interaction.isMessageComponent()) {
      const handler = this.componentHandlers.get(interaction.customId);
      if (handler) {
        const promise = handler.handle(interaction);
        if (promise instanceof Promise) {
          await promise;
        }
      }
    } else if (interaction.isModalSubmit()) {
      const handler = this.modalHandlers.get(interaction.customId);
      if (handler) {
        const promise = handler.handle(interaction);
        if (promise instanceof Promise) {
          await promise;
        }
      }
    }
  }
}
