import {
  InteractionCallbackResponse,
  type Message,
  type ModalBuilder,
  type ModalComponentData,
  type RepliableInteraction,
} from 'discord.js';

import { coreLog } from '../internal/coreLog.js';
import { safeRender } from '../util/discord/safeRender.js';

import type { ModalRepliableInteraction } from '../lib/interactivity/modalHandling.js';
import type { Payload } from './payload.js';

export enum BufferedPatchStatus {
  Completed,
  Cancelled,
}

export enum PatchType {
  Create,
  Update,
}

interface PatchOptions {
  type: PatchType;
}

export interface BufferedPatch {
  promiseResolve: (result: BufferedPatchStatus) => void;
  payload: Payload;
  options: PatchOptions;
}

type TrackedAction = Promise<unknown>;

export class InteractionPatcher {
  private logger = coreLog.namespaced('InteractionPatcher');
  private patching = false;
  private trackedActions = new Map<string, TrackedAction>();
  private activePatchPromise: Promise<Message | undefined> | undefined;
  message?: Message;
  bufferedPatch: BufferedPatch | null = null;
  disposed = false;

  constructor(public interaction?: RepliableInteraction) {}

  mountInteraction(interaction: RepliableInteraction): void {
    this.interaction = interaction;
  }

  isPatching(): boolean {
    return this.patching;
  }

  deferUpdate(interaction: RepliableInteraction): TrackedAction | undefined {
    if (this.disposed) return;

    const id = interaction.id;
    this.logger.debug('InteractionPatcher.deferUpdate', { id });
    if (this.patching && this.interaction?.id === id) {
      this.logger.debug('Not deferring update since this interaction is already being patched.', {
        id,
      });
      return;
    }

    if (interaction.isMessageComponent() && !interaction.deferred && !interaction.replied) {
      this.logger.debug('Should defer', { id });
      if (this.trackedActions.has(id)) {
        // Already deferring.
        this.logger.debug('(deferUpdate) -> Already performing an action', {
          id,
        });
        return;
      }

      const tracked: TrackedAction = new Promise<unknown>((resolve, reject) => {
        interaction
          .deferUpdate()
          .then((res) => {
            this.logger.verbose('Tracked deferUpdate complete', { id });
            resolve(res);
          })
          .catch((e) => {
            this.logger.error('Error in tracked deferUpdate', e);
            reject(e);
          })
          .finally(() => {
            this.trackedActions.delete(id);
          });
      });
      this.trackedActions.set(id, tracked);
      return tracked;
    }
  }

  showModal(
    interaction: ModalRepliableInteraction,
    modal: ModalComponentData | ModalBuilder,
  ): void {
    if (this.disposed) return;

    const id = interaction.id;
    this.logger.debug('InteractionPatcher.showModal', { id });
    if (this.patching && this.interaction?.id === id) {
      this.logger.debug('Not showing a modal since this interaction is already being patched.', {
        id,
      });
      return;
    }

    if (this.trackedActions.has(id)) {
      // Already deferring.
      this.logger.debug('(showModal) -> Already performing an action', { id });
      return;
    }

    const tracked: TrackedAction = new Promise<InteractionCallbackResponse>((resolve, reject) => {
      interaction
        .showModal(modal)
        .then((res) => {
          this.logger.verbose('Tracked showModal complete', { id });
          resolve(res as any);
        })
        .catch((e) => {
          this.logger.error('Error in tracked showModal', e);
          reject(e);
        })
        .finally(() => {
          this.trackedActions.delete(id);
        });
    });
    this.trackedActions.set(id, tracked);
  }

  async patch(payload: Payload, options: PatchOptions): Promise<BufferedPatchStatus> {
    if (this.disposed) return new Promise(() => undefined);
    if (!this.interaction) {
      throw new Error('No interaction was mounted, yet patch was requested.');
    }

    this.logger.debug(`Patch called with interaction.id=${this.interaction.id}`);
    if (this.patching) {
      this.cancelBufferedPatch();
      let promiseResolve!: (result: BufferedPatchStatus) => void;
      const promise = new Promise<BufferedPatchStatus>((resolve) => {
        promiseResolve = resolve;
      });
      this.bufferedPatch = {
        payload,
        options,
        promiseResolve,
      };
      return promise;
    }

    this.logger.debug('No patch was buffered, begin patch.');
    this.patching = true;
    try {
      const activeDeferUpdate = this.trackedActions.get(this.interaction.id);
      if (activeDeferUpdate) {
        this.logger.debug('There is an active defer. Waiting...');
        await activeDeferUpdate;
        this.logger.debug('Resolved active defer.');
      }
      this.message =
        (await (this.activePatchPromise = safeRender(this.interaction, payload, {
          retrieveMessage: options.type === PatchType.Create,
          preferReplyForComponent: false,
          initialMessage: this.message,
        }))) ?? this.message;
    } finally {
      this.patching = false;
      this.activePatchPromise = undefined;
    }

    if (this.bufferedPatch) {
      this.logger.debug('Patch complete, but another was buffered...');
      const buffered = this.bufferedPatch;
      this.bufferedPatch = null;
      return await this.patch(buffered.payload, buffered.options);
    } else {
      this.logger.debug('Patch complete.');
      return BufferedPatchStatus.Completed;
    }
  }

  async stop(): Promise<void> {
    if (this.disposed) return;
    this.cancelBufferedPatch();
    if (!this.interaction) {
      return;
    }

    try {
      const activeDeferUpdate = this.trackedActions.get(this.interaction.id);
      if (activeDeferUpdate) {
        this.logger.debug('Stop encountered active defer.');
        await activeDeferUpdate;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_: unknown) {
      this.logger.verbose('Error while stop was waiting for active defer update.');
    }
    this.logger.debug('Stop resolved active defer.');
    this.trackedActions.clear();

    if (this.patching) {
      await this.activePatchPromise;
    }
  }

  async delete(message?: Message): Promise<void> {
    if (this.disposed) return;

    this.cancelBufferedPatch();
    if (!this.interaction) {
      throw new Error('No interaction was mounted, yet delete was requested.');
    }

    const activeDeferUpdate = this.trackedActions.get(this.interaction.id);
    if (activeDeferUpdate) {
      this.logger.debug('Delete encountered active defer.');
      try {
        await activeDeferUpdate;
      } catch (error: unknown) {
        this.logger.verbose('Error while delete was waiting for active defer update.', { error });
      }
      this.logger.debug('Delete resolved active defer.');
    }

    if (this.patching) {
      await this.activePatchPromise;
    }

    if (!this.interaction.deferred && !this.interaction.replied) {
      const tracked = this.deferUpdate(this.interaction);
      if (!tracked) {
        // Something went terribly wrong. Prevent infinite recursion.
        return;
      }
      return this.delete(message);
    }

    this.patching = true;
    try {
      this.activePatchPromise = this.interaction.deleteReply(message).then(() => undefined);
      await this.activePatchPromise;
      if (message === this.message) {
        this.message = undefined;
      }
    } catch (error: unknown) {
      this.logger.error('Error when deleting reply', error);
      throw error;
    } finally {
      this.patching = false;
    }
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.cancelBufferedPatch();
    this.trackedActions.clear();
    this.activePatchPromise?.then(() => undefined);
  }

  private cancelBufferedPatch() {
    if (this.bufferedPatch) {
      this.logger.debug('Cancelling buffered patch.');
      this.bufferedPatch.promiseResolve(BufferedPatchStatus.Cancelled);
    }
  }
}
