import {
  Client,
  CollectedInteraction,
  MessageFlags,
  MessageFlagsBitField,
  RepliableInteraction,
} from 'discord.js';
import { logger } from '../util/Logger.js';
import {
  PatchTarget,
  type PatchTargetBitMask,
} from '../lib/RenderingEngine.js';
import { getOwner, type Owner, runWithOwner } from '../lib/owners/owner.js';
import type { InteractionMiddleware } from './interactionMiddleware.js';
import type { Payload } from './payload.js';
import type {
  CollectedInteractionHandlerData,
  ModalInteractionHandlerData,
} from './interactionHandlerData.js';
import type { Strand } from './strands/strand.js';
import { getActiveCords } from './registry.js';
import { getConfig } from '../config.js';
import type { ViewFactory } from './menuBuilder.js';
import type { StrandFactory } from './strands/strandFactory.js';

export enum DispatchMode {
  Create,
  Update,
}

export type BuiltInCloseReasons = 'MANUAL_CLOSE' | 'IDLE_TIMEOUT';

/**
 * Simple API over a Cord instance.
 */
export interface CordAPI {
  readonly messageId?: string;
  readonly channelId?: string;
  readonly ephemeral: boolean;

  createUniqueComponentId(): `__component_${number}`;
  close(
    reason?: BuiltInCloseReasons | (string & {}),
    data?: unknown,
  ): Promise<void>;
}

/**
 * Data returned from the promise returned from {@link Cord.mount}
 */
export interface MountFinish {
  reason: string;
  data: unknown;
}

export class Cord implements CordAPI {
  private readonly strands: Strand[] = [];
  private interactionPipeline: InteractionMiddleware[] = [];
  private updateQueued = false;
  private disposed = false;
  private dirtyMask: PatchTargetBitMask = 0;
  private idleTimer?: ReturnType<typeof setTimeout>;
  messageId?: string;
  channelId?: string;
  ephemeral = false;
  private client?: Client;
  private nextComponentId = 0;
  private resolveMountPromise?: (value: MountFinish) => void;
  private pendingClose?: MountFinish;
  protected latestInteraction?: RepliableInteraction;

  constructor(private readonly strandFactory: StrandFactory) {}

  get currentStrand(): Strand {
    const top = this.strands[this.strands.length - 1];
    if (!top) {
      throw new Error('Strand stack is empty.');
    }
    return top;
  }

  isDisposed() {
    return this.disposed;
  }

  markDirty(patchTargetMask: PatchTargetBitMask): void {
    if (patchTargetMask === PatchTarget.None) return;
    this.dirtyMask |= patchTargetMask;
    this.queueUpdate();
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);

    this.idleTimer = setTimeout(() => {
      void this.close('IDLE_TIMEOUT');
    }, getConfig().defaultIdleTimeoutMs);
  }

  createUniqueComponentId(): `__component_${number}` {
    return `__component_${this.nextComponentId++}`;
  }

  createStrand(factory: ViewFactory): Strand {
    return this.strandFactory(this, factory);
  }

  pushStrand(strand: Strand): void {
    const top = this.strands[this.strands.length - 1];
    if (top) {
      top.suspend?.();
    }
    this.strands.push(strand);
    this.queueUpdate();
  }

  popStrand(): void {
    const popped = this.strands.pop();
    if (popped) {
      popped.destroy();
    }

    const top = this.strands[this.strands.length - 1];
    if (top) {
      top.resume?.();
    }

    this.queueUpdate();
  }

  replaceStrand(strand: Strand): void {
    this.popStrand();
    this.pushStrand(strand);
    this.queueUpdate();
  }

  canGoBack(): boolean {
    return this.strands.length > 1;
  }

  async mount(
    interaction: RepliableInteraction,
    ephemeral: boolean,
  ): Promise<MountFinish> {
    if (this.resolveMountPromise) {
      throw new Error('Already mounted');
    }

    this.ephemeral = ephemeral;
    const currentStrand = this.currentStrand;
    if (!currentStrand) {
      throw new Error('No strand to mount');
    }
    const payload = currentStrand.render();
    this.dirtyMask = PatchTarget.None;
    if (this.ephemeral) {
      if (payload.flags != null) {
        payload.flags = MessageFlagsBitField.resolve([
          Array.isArray(payload.flags) ? payload.flags : [payload.flags],
          MessageFlags.Ephemeral,
        ]);
      } else {
        payload.flags = MessageFlags.Ephemeral;
      }
    }

    this.resetIdleTimer();
    let response = await this.dispatchPayload(
      payload,
      DispatchMode.Create,
      interaction,
    );
    if (response && 'resource' in response) {
      response = response.resource?.message ?? undefined;
    }
    if (response) {
      this.client = response.client;
      this.messageId = response.id;
      this.channelId = response.channelId;

      getActiveCords().set(this.messageId, this);
    }

    this.latestInteraction = interaction;

    return new Promise<MountFinish>((res) => {
      this.resolveMountPromise = res;
    });
  }

  async close(
    reason: BuiltInCloseReasons | (string & {}) = 'MANUAL_CLOSE',
    data?: unknown,
  ) {
    if (this.pendingClose) return;
    this.pendingClose = { reason, data };
    this.queueUpdate();
  }

  private async flushClose(
    interaction: RepliableInteraction | undefined,
    mountFinish: MountFinish,
  ) {
    if (this.idleTimer) clearTimeout(this.idleTimer);

    if (this.messageId) {
      getActiveCords().delete(this.messageId);
    }

    while (this.strands.length) {
      this.strands.pop()?.destroy();
    }

    if (interaction) {
      if (!interaction.deferred && !interaction.replied) {
        await (
          interaction.isMessageComponent() || interaction.isModalSubmit()
            ? interaction.deferUpdate()
            : interaction.deferReply()
        ).catch(() => {});
      }
      await interaction.deleteReply().catch(() => {});
    } else if (
      !this.ephemeral &&
      this.client &&
      this.messageId &&
      this.channelId
    ) {
      const channel = this.client.channels.cache.get(this.channelId);
      if (channel?.isSendable()) {
        await channel.messages.delete(this.messageId).catch(() => {});
      }
    }

    this.resolveMountPromise?.(mountFinish);
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
        if (this.pendingClose) {
          await this.flushClose(interaction, this.pendingClose);
          return;
        }

        if (this.dirtyMask === PatchTarget.None) {
          if (active.isMessageComponent() || active.isModalSubmit()) {
            if (!active.deferred && !active.replied) {
              await active.deferUpdate();
              if (this.dirtyMask !== PatchTarget.None) {
                this.queueUpdate();
              }
            }
          }
        } else {
          console.log('flushing');
          await this.flushUpdate(active);
        }
      } catch (error: unknown) {
        console.error(error);
      }
    });
  }

  /**
   * Queues a deferred update for a message component interaction.
   * @param interaction The interaction to defer.
   */
  deferUpdate(interaction?: RepliableInteraction) {
    if (
      interaction?.isMessageComponent() &&
      !interaction.deferred &&
      !interaction.replied
    ) {
      this.queueUpdate(interaction);
    }
  }

  /**
   * Flush the payload to the given interaction. Falls back to the mounted
   * message on the latest call to {@link mount}.
   * @param interaction
   */
  async flushUpdate(
    interaction: RepliableInteraction | undefined,
  ): Promise<void> {
    const payload = this.currentStrand.render();
    console.log('payload', JSON.stringify(payload, null, 2));
    this.dirtyMask = PatchTarget.None;
    await this.dispatchPayload(payload, DispatchMode.Update, interaction);
  }

  /**
   * Registers a handler for a specific component ID.
   */
  registerComponent(
    customId: string,
    handler: CollectedInteractionHandlerData['handle'],
  ) {
    if (this.currentStrand.componentHandlers.has(customId)) {
      logger.warn(`[Cord] Overwriting existing handler for ${customId}`);
    }

    this.currentStrand.componentHandlers.set(customId, {
      handle: handler,
      owner: getOwner(),
    });

    return () => {
      this.currentStrand.componentHandlers.delete(customId);
    };
  }

  registerModal(id: string, handler: ModalInteractionHandlerData['handle']) {
    this.currentStrand.modalHandlers.set(id, {
      handle: handler,
      owner: getOwner(),
    });
    return () => {
      this.currentStrand.modalHandlers.delete(id);
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
        await this.currentStrand.executeComponentHandler(interaction);
        this.queueUpdate(interaction);
        return;
      }

      await middleware(interaction, () => dispatch(i + 1));
    };

    this.resetIdleTimer();
    this.queueUpdate(interaction);

    let owner: Owner | null = null;
    if (interaction.isMessageComponent()) {
      owner =
        this.currentStrand.componentHandlers.get(interaction.customId)?.owner ??
        null;
    } else if (interaction.isModalSubmit()) {
      owner =
        this.currentStrand.modalHandlers.get(interaction.customId)?.owner ??
        null;
    }

    void runWithOwner(owner, () => dispatch(0));
  }

  protected async dispatchPayload(
    payload: Payload,
    mode: DispatchMode,
    interaction: RepliableInteraction | undefined,
  ) {
    // Not gonna deal with the typing headache: any it is.
    const options: any =
      mode === DispatchMode.Create ? { ...payload, fetchReply: true } : payload;

    if (!interaction) {
      // Fall back to dispatching to the channel instead.
      if (this.client && this.channelId && this.messageId) {
        const channel = this.client.channels.cache.get(this.channelId);
        if (channel?.isSendable()) {
          if (mode === DispatchMode.Create) {
            return await channel.send(options);
          } else {
            await channel.messages.edit(this.messageId, options);
          }
        }
      }
      return;
    }

    if (mode === DispatchMode.Create) {
      return interaction.replied
        ? await interaction.followUp(options)
        : interaction.deferred
          ? await interaction.editReply(options)
          : await interaction.reply(options);
    } else if (mode === DispatchMode.Update) {
      console.log('mode === DispatchMode.Update');
      if (!interaction.replied && !interaction.deferred) {
        console.log('!interaction.replied && !interaction.deferred');
        if (interaction.isMessageComponent()) {
          console.log('interaction.isMessageComponent()');
          await interaction.update(options);
          return;
        }
        console.log('!interaction.isMessageComponent()');
      }
      console.log('interaction.editReply(options)');
      await interaction.editReply(options);
    } else {
      throw new Error(mode satisfies never);
    }
  }
}
