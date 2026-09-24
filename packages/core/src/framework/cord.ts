import {
  Client,
  CollectedInteraction,
  MessageFlags,
  MessageFlagsBitField,
  RepliableInteraction,
} from 'discord.js';

import { getConfig } from '../config.js';
import { coreLog } from '../internal/coreLog.js';
import { AutoComponentId } from '../lib/components/autocomponents.js';
import { onCleanup } from '../lib/hooks/onCleanup.js';
import { getOwner, type Owner, runWithOwner } from '../lib/owners/owner.js';

import { InteractionPatcher, PatchType } from './interactionPatcher.js';
import { PatchTarget, type PatchTargetBitMask } from './patchTarget.js';
import { getActiveCords } from './registry.js';

import type {
  CollectedInteractionHandlerData,
  ModalInteractionHandlerData,
} from './interactionHandlerData.js';
import type { InteractionMiddleware } from './interactionMiddleware.js';
import type { ViewFactory } from './menuBuilder.js';
import type { Payload } from './payload.js';
import type { Strand } from './strands/strand.js';
import type { StrandFactory } from './strands/strandFactory.js';

export type BuiltInCloseReasons = 'MANUAL_CLOSE' | 'MANUAL_STOP' | 'IDLE_TIMEOUT';

/**
 * Simple API over a Cord instance.
 */
export interface CordAPI {
  readonly messageId?: string;
  readonly channelId?: string;
  readonly ephemeral: boolean;

  createUniqueComponentId(): `__component_${number}`;
  close(reason?: BuiltInCloseReasons | (string & {}), data?: unknown): Promise<void>;
}

/**
 * Data returned from the promise returned from {@link Cord.mount}
 */
export interface MountFinish {
  reason: BuiltInCloseReasons | (string & {});
  data: unknown;
}

export class Cord implements CordAPI {
  private readonly logger = coreLog.namespaced('Cord');
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
  private interactionPatcher = new InteractionPatcher();
  private resolveMountPromise?: (value: MountFinish) => void;
  protected latestInteraction?: RepliableInteraction;

  constructor(private readonly strandFactory: StrandFactory) {}

  get currentStrand(): Strand {
    const top = this.strands[this.strands.length - 1];
    if (!top) {
      throw new Error('Strand stack is empty.');
    }
    return top;
  }

  get dirty(): PatchTargetBitMask {
    return this.dirtyMask;
  }

  isDisposed() {
    return this.disposed;
  }

  markDirty(patchTargetMask: PatchTargetBitMask): void {
    if (patchTargetMask === PatchTarget.None) return;
    this.dirtyMask |= patchTargetMask;
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
    this.markDirty(PatchTarget.All);
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
    this.markDirty(PatchTarget.All);
  }

  replaceStrand(strand: Strand): void {
    this.popStrand();
    this.pushStrand(strand);
    this.markDirty(PatchTarget.All);
  }

  canGoBack(): boolean {
    return this.strands.length > 1;
  }

  async mount(interaction: RepliableInteraction, ephemeral: boolean): Promise<MountFinish> {
    if (this.resolveMountPromise) {
      throw new Error('Already mounted');
    }
    this.ephemeral = ephemeral;
    this.interactionPatcher.mountInteraction(interaction);
    const currentStrand = this.currentStrand;
    if (!currentStrand) {
      throw new Error('No strand to mount');
    }
    const payload = currentStrand.render();
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
    let response = await this.dispatchPayload(payload, PatchType.Create, interaction);
    this.dirtyMask = PatchTarget.None;
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

  async stop(reason: BuiltInCloseReasons | (string & {}) = 'MANUAL_STOP', data?: unknown) {
    await this.flushDispose(undefined, { reason, data }, false);
  }

  async close(reason: BuiltInCloseReasons | (string & {}) = 'MANUAL_CLOSE', data?: unknown) {
    await this.flushDispose(undefined, { reason, data }, true);
  }

  private async flushDispose(
    interaction: RepliableInteraction | undefined,
    mountFinish: MountFinish,
    deleteMessage: boolean,
  ) {
    if (this.disposed) return;
    this.disposed = true;

    if (this.idleTimer) clearTimeout(this.idleTimer);

    if (this.messageId) {
      getActiveCords().delete(this.messageId);
    }

    if (interaction) this.interactionPatcher.mountInteraction(interaction);
    if (deleteMessage) {
      await this.interactionPatcher.delete(this.interactionPatcher.message);
    }
    this.interactionPatcher.dispose();

    while (this.strands.length) {
      this.strands.pop()?.destroy();
    }

    this.resolveMountPromise?.(mountFinish);
  }

  queueUpdate(interaction?: RepliableInteraction, debugSource = 'external_caller') {
    this.logger.debug(
      `queueUpdate(${interaction?.isMessageComponent() ? interaction.customId : (interaction?.id ?? 'none')}, ${debugSource})`,
    );
    if (interaction) {
      this.latestInteraction = interaction;
      this.interactionPatcher.mountInteraction(interaction);
    }

    if (this.updateQueued) return;
    this.updateQueued = true;

    queueMicrotask(async () => {
      this.updateQueued = false;
      if (this.disposed) return;

      this.logger.debug('Update microtask has run');
      if (this.disposed) {
        this.logger.debug('...but the Cord was disposed');
        return;
      }

      if (this.dirtyMask === PatchTarget.None) {
        this.logger.debug('...but the Cord has no dirty mask');
        return;
      }
      await this.flushUpdate(undefined /* use the latest interaction */);
    });
  }

  /**
   * Queues a deferred update for a message component interaction.
   * @param interaction The interaction to defer.
   */
  deferUpdate(interaction?: RepliableInteraction) {
    const toDefer = interaction ?? this.latestInteraction;
    if (toDefer) {
      this.interactionPatcher.deferUpdate(toDefer);
    }
  }

  /**
   * Flush the payload to the given interaction. Falls back to the mounted
   * message on the latest call to {@link mount}.
   * @param interaction
   */
  async flushUpdate(interaction: RepliableInteraction | undefined): Promise<void> {
    const payload = this.currentStrand.render();
    if (!payload) {
      this.deferUpdate(interaction);
      return;
    }
    this.dirtyMask = PatchTarget.None;
    await this.dispatchPayload(payload, PatchType.Update, interaction);
  }

  /**
   * Registers a handler for a specific component ID.
   */
  registerComponent(customId: string, handler: CollectedInteractionHandlerData['handle']) {
    const strand = this.currentStrand;
    if (strand.componentHandlers.has(customId)) {
      this.logger.warn(`Overwriting existing handler for ${customId}`);
    }

    strand.componentHandlers.set(customId, {
      handle: handler,
      owner: getOwner(),
    });

    const dispose = () => {
      strand.componentHandlers.delete(customId);
    };
    onCleanup(dispose);
    return dispose;
  }

  registerModal(id: string, handler: ModalInteractionHandlerData['handle']) {
    const strand = this.currentStrand;
    strand.modalHandlers.set(id, {
      handle: handler,
      owner: getOwner(),
    });
    return () => {
      strand.modalHandlers.delete(id);
    };
  }

  use(middleware: InteractionMiddleware) {
    this.interactionPipeline.push(middleware);
  }

  async handleInteraction(interaction: CollectedInteraction) {
    if (interaction.isButton() && interaction.customId === AutoComponentId.CloseMenuButton) {
      // TODO: Maybe the CloseButton auto-component should be... a normal component with a default
      //       handler?
      await this.close();
      return;
    }

    let index = -1;

    // TODO: Modal components should map their *original* customId since we
    //       clobbered it.

    const strand = this.currentStrand;
    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;

      const middleware = this.interactionPipeline[i];
      if (!middleware) {
        await strand.executeComponentHandler(interaction);
        this.queueUpdate(interaction, 'middleware_after_component_exec: ' + interaction.customId);
        return;
      }

      await middleware(interaction, () => dispatch(i + 1));
    };

    this.resetIdleTimer();
    this.queueUpdate(interaction, 'middleware_before_component_exec: ' + interaction.customId);

    let owner: Owner | null = null;
    if (interaction.isMessageComponent()) {
      owner = strand.componentHandlers.get(interaction.customId)?.owner ?? null;
    } else if (interaction.isModalSubmit()) {
      owner = strand.modalHandlers.get(interaction.customId)?.owner ?? null;
      if (!interaction.deferred) {
        void interaction.deferUpdate().catch(() => {});
      }
    }

    await runWithOwner(owner, async () => await dispatch(0));
  }

  protected async dispatchPayload(
    payload: Payload,
    mode: PatchType,
    interaction: RepliableInteraction | undefined,
  ) {
    interaction ??= this.interactionPatcher.interaction;

    if (interaction) {
      this.interactionPatcher.mountInteraction(interaction);
      await this.interactionPatcher.patch(payload, { type: mode });
      return this.interactionPatcher.message;
    }

    // Fall back to dispatching to the channel instead.
    if (!(this.client && this.channelId && this.messageId)) {
      return;
    }
    const channel = this.client.channels.cache.get(this.channelId);
    if (!channel?.isSendable()) {
      return;
    }
    if (mode === PatchType.Create) {
      return await channel.send(payload as any);
    } else {
      await channel.messages.edit(this.messageId, payload as any);
    }
  }
}
