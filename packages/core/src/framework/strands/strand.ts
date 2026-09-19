import {CollectedInteraction} from 'discord.js';

import {CurrentRepliableContext} from '../../core/contexts/currentRepliableContext.js';
import {
  ImperativeLockContext,
  ImperativeLockKind,
} from '../../core/contexts/imperativeLock.js';
import {provideContextValue} from '../../lib/contexts/provideContext.js';
import {getOwnerOrThrow, owner} from '../../lib/owners/owner.js';
import type {Cord} from '../cord.js';
import type {
  CollectedInteractionHandlerData,
  ModalInteractionHandlerData,
} from '../interactionHandlerData.js';
import type {Payload} from '../payload.js';

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
        await this.callComponentHandler(interaction, handler);
      }
    } else if (interaction.isModalSubmit()) {
      const handler = this.modalHandlers.get(interaction.customId);
      if (handler) {
        await this.callComponentHandler(interaction, handler);
      }
    }
  }

  private async callComponentHandler(
    interaction: CollectedInteraction,
    handler: CollectedInteractionHandlerData,
  ) {
    const handlerOwner = await owner(async () => {
      provideContextValue(CurrentRepliableContext, interaction);
      provideContextValue(
        ImperativeLockContext,
        ImperativeLockKind.InteractionHandler,
      );

      const promise = handler.handle(interaction);
      if (promise instanceof Promise) {
        await promise;
      }
      return getOwnerOrThrow();
    });
    handlerOwner.dispose();
  }
}
