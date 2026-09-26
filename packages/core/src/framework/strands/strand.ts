import { CollectedInteraction, ComponentType, InteractionType } from 'discord.js';

import { getConfig } from '../../config.js';
import { CurrentRepliableContext } from '../../core/contexts/currentRepliableContext.js';
import { ImperativeLockContext, ImperativeLockKind } from '../../core/contexts/imperativeLock.js';
import { OwnerTraceContext, OwnerTraceType } from '../../core/contexts/ownerTraceContext.js';
import { enhanceErrorWithComponentStack } from '../../core/utils/errorStack.js';
import { coreLog } from '../../internal/coreLog.js';
import { provideContextValue } from '../../lib/contexts/provideContext.js';
import { ContextShadowOwner, getOwner, runWithOwner } from '../../lib/owners/owner.js';

import type { Cord } from '../cord.js';
import type {
  CollectedInteractionHandlerData,
  ModalInteractionHandlerData,
} from '../interactionHandlerData.js';
import type { Payload } from '../payload.js';

/**
 * An active view for a given {@link Cord}.
 */
export abstract class Strand {
  readonly componentHandlers = new Map<string, CollectedInteractionHandlerData>();
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
    const currentOwner = getOwner();
    if (!currentOwner) {
      coreLog.warn('Interaction handler called without an owner');
      return;
    }
    const handlerOwner = new ContextShadowOwner(currentOwner);
    try {
      await runWithOwner(handlerOwner, async () => {
        provideContextValue(CurrentRepliableContext, interaction);
        provideContextValue(ImperativeLockContext, ImperativeLockKind.InteractionHandler);
        if (getConfig().componentStacks) {
          const name = handler.handle.name || 'Handler';
          const fields = [`type: ${InteractionType[interaction.type]}`];
          if (interaction.isMessageComponent()) {
            fields.push(`componentType: ${ComponentType[interaction.componentType]}`);
          }
          fields.push(`id: "${interaction.customId}"`);

          provideContextValue(OwnerTraceContext, {
            type: OwnerTraceType.Handler,
            name,
            details: fields.join(', '),
          });
        }

        const promise = handler.handle(interaction);
        if (promise instanceof Promise) {
          await promise;
        }
      });
    } catch (error: unknown) {
      throw enhanceErrorWithComponentStack(error, handlerOwner);
    }
  }
}
