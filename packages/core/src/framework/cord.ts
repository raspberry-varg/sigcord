import {
  CollectedInteraction,
  type ModalSubmitInteraction,
  RepliableInteraction,
} from 'discord.js';
import { logger } from '../util/Logger.js';
import {
  PatchTarget,
  type PatchTargetBitMask,
} from '../lib/RenderingEngine.js';

type InteractionMiddleware = (
  interaction: CollectedInteraction,
  next: () => Promise<void>,
) => void | Promise<void>;

export abstract class Cord {
  private componentHandlers = new Map<
    string,
    (interaction: CollectedInteraction) => void | Promise<void>
  >();
  private modalHandlers = new Map<
    string,
    (interaction: ModalSubmitInteraction) => void | Promise<void>
  >();
  private interactionPipeline: InteractionMiddleware[] = [];
  private updateQueued = false;
  private disposed = false;
  private dirtyMask: PatchTargetBitMask = 0;
  protected latestInteraction?: RepliableInteraction;

  protected constructor(readonly id: string) {}

  isDisposed() {
    return this.disposed;
  }

  queueUpdate(interaction?: RepliableInteraction) {
    if (interaction) {
      this.latestInteraction = interaction;
    }

    if (this.updateQueued) return;
    this.updateQueued = true;

    queueMicrotask(async () => {
      this.updateQueued = false;

      const active = this.latestInteraction;
      if (!active) {
        return;
      }

      try {
        if (this.dirtyMask === PatchTarget.None) {
          if (active.isMessageComponent()) {
            this.deferUpdate(active);
          }
        } else {
          await this.flushUpdate(active);
        }
      } catch (error: unknown) {
        logger.error(error);
      }
    });
  }

  /**
   * Defers an update for a message component interaction.
   * @param interaction The interaction to defer.
   */
  deferUpdate(interaction?: RepliableInteraction) {
    interaction ??= this.latestInteraction;
    if (
      interaction?.isMessageComponent() &&
      !interaction.deferred &&
      !interaction.replied
    ) {
      void interaction.deferUpdate().catch(() => {});
    }
  }

  abstract flushUpdate(
    interaction: RepliableInteraction | undefined,
  ): Promise<void>;

  /**
   * Registers a handler for a specific component ID.
   */
  registerComponent(
    customId: string,
    handler: (interaction: any) => Promise<void> | void,
  ) {
    if (this.componentHandlers.has(customId)) {
      console.warn(`[Cord] Overwriting existing handler for ${customId}`);
    }

    this.componentHandlers.set(customId, handler);
    return () => {
      this.componentHandlers.delete(customId);
    };
  }

  registerModal(
    id: string,
    handler: (interaction: ModalSubmitInteraction) => Promise<void> | void,
  ) {
    this.modalHandlers.set(id, handler);
    return () => {
      this.modalHandlers.delete(id);
    };
  }

  use(middleware: InteractionMiddleware) {
    this.interactionPipeline.push(middleware);
  }

  async handleInteraction(interaction: CollectedInteraction) {
    let index = -1;

    // TODO: Modal components should map their *original* customId since we
    // clobbered it.

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;

      const middleware = this.interactionPipeline[i];
      if (!middleware) {
        await this.executeComponent(interaction);
        return;
      }

      await middleware(interaction, () => dispatch(i + 1));
    };

    this.queueUpdate(interaction);
    await dispatch(0);
  }

  private executeComponent = async (interaction: CollectedInteraction) => {
    if (interaction.isMessageComponent()) {
      const handler = this.componentHandlers.get(interaction.customId);
      if (handler) {
        const promise = handler(interaction);
        if (promise instanceof Promise) {
          await promise;
        }
      }
    } else if (interaction.isModalSubmit()) {
      const handler = this.modalHandlers.get(interaction.customId);
      if (handler) {
        const promise = handler(interaction);
        if (promise instanceof Promise) {
          await promise;
        }
      }
    }
  };
}
