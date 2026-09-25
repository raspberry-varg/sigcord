import {
  InteractionCallbackResponse,
  type Message,
  type ModalBuilder,
  type ModalComponentData,
  type RepliableInteraction,
} from 'discord.js';

import { coreLog } from '../../../internal/coreLog.js';
import { safeRender } from '../../../util/discord/safeRender.js';

import type { ModalRepliableInteraction } from '../../interactivity/modalHandling.js';
import type { ViewMessagePayload } from '../../views/viewFlavors.js';
import type { IntrinsicMenuProps } from '../defineMenu.js';
import type { RenderOptions } from './menuInstance.js';

export enum BufferedPatchStatusLegacy {
  Completed,
  Cancelled,
}

export interface BufferedPatchLegacy {
  promiseResolve: (result: BufferedPatchStatusLegacy) => void;
  payload: ViewMessagePayload;
  options: Partial<RenderOptions>;
}

type TrackedAction = Promise<unknown>;

export class InteractionPatcherLegacy {
  private logger = coreLog.namespaced('InteractionPatcherLegacy');
  private patching = false;
  private trackedActions = new Map<string, TrackedAction>();
  private activePatchPromise: Promise<Message | undefined> | undefined;
  message?: Message;
  bufferedPatch: BufferedPatchLegacy | null = null;

  constructor(
    public interaction: RepliableInteraction | undefined,
    private readonly props: Readonly<IntrinsicMenuProps> | undefined,
  ) {}

  mountInteraction(interaction: RepliableInteraction): void {
    this.interaction = interaction;
  }

  isPatching(): boolean {
    return this.patching;
  }

  deferUpdate(interaction: RepliableInteraction): void {
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
    }
  }

  showModal(
    interaction: ModalRepliableInteraction,
    modal: ModalComponentData | ModalBuilder,
  ): void {
    const id = interaction.id;
    this.logger.debug('InteractionPatcher.showModal', { id });
    if (this.patching && this.interaction?.id === interaction.id) {
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

  async patch(
    payload: ViewMessagePayload,
    options: Partial<RenderOptions>,
  ): Promise<BufferedPatchStatusLegacy> {
    if (!this.interaction) {
      throw new Error('No interaction was mounted, yet patch was requested.');
    }

    this.logger.debug(`Patch called with interaction.id=${this.interaction.id}`);
    if (this.patching) {
      this.cancelBufferedPatch();
      let promiseResolve!: (result: BufferedPatchStatusLegacy) => void;
      const promise = new Promise<BufferedPatchStatusLegacy>((resolve) => {
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
          retrieveMessage: !this.message,
          initialMessage: this.props?.initialMessage ?? this.message,
          preferReplyForComponent: options.forceReply,
        }))) ?? this.message;
    } catch (error: unknown) {
      this.logger.error('Error during patch', error);
      queueMicrotask(() => {
        throw error;
      });
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
      return BufferedPatchStatusLegacy.Completed;
    }
  }

  async stop(): Promise<void> {
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

  async delete(message?: Message) {
    this.cancelBufferedPatch();
    if (!this.interaction) {
      throw new Error('No interaction was mounted, yet delete was requested.');
    }

    const activeDeferUpdate = this.trackedActions.get(this.interaction.id);
    if (activeDeferUpdate) {
      this.logger.debug('Delete encountered active defer.');
      try {
        await activeDeferUpdate;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_: unknown) {
        this.logger.verbose('Error while delete was waiting for active defer update.');
      }
      this.logger.debug('Delete resolved active defer.');
    }

    if (this.patching) {
      await this.activePatchPromise;
    }

    this.patching = true;
    try {
      await this.interaction.deleteReply(message);
    } catch (error: unknown) {
      this.logger.error('Error when deleting reply', error);
      throw error;
    } finally {
      this.patching = false;
    }
  }

  private cancelBufferedPatch() {
    if (this.bufferedPatch) {
      this.logger.debug('Cancelling buffered patch.');
      this.bufferedPatch.promiseResolve(BufferedPatchStatusLegacy.Cancelled);
    }
  }
}
