import {
  type Message,
  type ModalBuilder,
  type ModalComponentData,
  type RepliableInteraction,
} from 'discord.js';
import type { ViewMessagePayload } from '../../views/viewFlavors.js';
import { safeRender } from '../../../util/RenderingUtil.js';
import type { RenderOptions } from './menuInstance.js';
import type { IntrinsicMenuProps } from '../defineMenu.js';
import { Logger } from '../../../util/Logger.js';
import type { ModalRepliableInteraction } from '../../interactivity/modalHandling.js';

export enum BufferedPatchStatus {
  Completed,
  Cancelled,
}

export interface BufferedPatch {
  promiseResolve: (result: BufferedPatchStatus) => void;
  payload: ViewMessagePayload;
  options: Partial<RenderOptions>;
}

type TrackedAction = Promise<unknown>;

export class InteractionPatcher {
  private logger = Logger.namespaced('InteractionPatcher');
  private patching = false;
  private trackedActions = new Map<string, TrackedAction>();
  private activePatchPromise: Promise<Message> | undefined;
  message?: Message;
  bufferedPatch: BufferedPatch | null = null;

  constructor(
    public interaction: RepliableInteraction,
    private readonly props: Readonly<IntrinsicMenuProps>,
  ) {}

  mountInteraction(interaction: RepliableInteraction): void {
    this.interaction = interaction;
  }

  isPatching(): boolean {
    return this.patching;
  }

  deferUpdate(interaction: RepliableInteraction): void {
    this.logger.debug('InteractionPatcher.deferUpdate', interaction.id);
    if (this.patching && this.interaction.id === interaction.id) {
      this.logger.debug(
        'Not deferring update since this interaction is already being patched.',
        interaction.id,
      );
      return;
    }

    if (
      interaction.isMessageComponent() &&
      !interaction.deferred &&
      !interaction.replied
    ) {
      this.logger.debug('Should defer', interaction.id);
      const id = interaction.id;
      if (this.trackedActions.has(id)) {
        // Already deferring.
        this.logger.debug(
          '(deferUpdate) -> Already performing an action',
          interaction.id,
        );
        return;
      }

      const tracked: TrackedAction = new Promise<unknown>((resolve, reject) => {
        interaction
          .deferUpdate()
          .then((res) => {
            this.logger.verbose('Tracked deferUpdate complete', id);
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
    this.logger.debug('InteractionPatcher.showModal', interaction.id);
    if (this.patching && this.interaction.id === interaction.id) {
      this.logger.debug(
        'Not showing a modal since this interaction is already being patched.',
        interaction.id,
      );
      return;
    }

    const id = interaction.id;
    if (this.trackedActions.has(id)) {
      // Already deferring.
      this.logger.debug(
        '(showModal) -> Already performing an action',
        interaction.id,
      );
      return;
    }

    const tracked: TrackedAction = new Promise<void>((resolve, reject) => {
      interaction
        .showModal(modal)
        .then((res) => {
          this.logger.verbose('Tracked showModal complete', id);
          resolve(res);
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
  ): Promise<BufferedPatchStatus> {
    this.logger.info(`Patch called with interaction.id=${this.interaction.id}`);
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

    this.logger.info('No patch was buffered, begin patch.');
    this.patching = true;
    try {
      const activeDeferUpdate = this.trackedActions.get(this.interaction.id);
      if (activeDeferUpdate) {
        this.logger.debug('There is an active defer. Waiting...');
        await activeDeferUpdate;
        this.logger.debug('Resolved active defer.');
      }
      this.message = await (this.activePatchPromise = safeRender(
        this.interaction,
        payload,
        this.props,
        options.forceReply,
      ));
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
      const { payload, options } = this.bufferedPatch;
      this.bufferedPatch = null;
      return await this.patch(payload, options);
    } else {
      this.logger.debug('Patch complete.');
      return BufferedPatchStatus.Completed;
    }
  }

  async stop(): Promise<void> {
    this.cancelBufferedPatch();

    try {
      const activeDeferUpdate = this.trackedActions.get(this.interaction.id);
      if (activeDeferUpdate) {
        this.logger.debug('Stop encountered active defer.');
        await activeDeferUpdate;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_: unknown) {
      this.logger.verbose(
        'Error while stop was waiting for active defer update.',
      );
    }
    this.logger.debug('Stop resolved active defer.');
    this.trackedActions.clear();

    if (this.patching) {
      await this.activePatchPromise;
    }
  }

  async delete(message?: Message) {
    this.cancelBufferedPatch();

    const activeDeferUpdate = this.trackedActions.get(this.interaction.id);
    if (activeDeferUpdate) {
      this.logger.debug('Delete encountered active defer.');
      try {
        await activeDeferUpdate;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_: unknown) {
        this.logger.verbose(
          'Error while delete was waiting for active defer update.',
        );
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
      this.logger.info('Cancelling buffered patch.');
      this.bufferedPatch.promiseResolve(BufferedPatchStatus.Cancelled);
    }
  }
}
