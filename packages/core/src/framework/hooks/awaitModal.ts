import * as crypto from 'crypto';

import { ModalBuilder, type ModalComponentData, type ModalSubmitInteraction } from 'discord.js';

import { coreLog } from '../../internal/coreLog.js';
import { getCurrentSynapseOrDefault } from '../../lib/builtins/currentSynapse.js';
import { onCleanup } from '../../lib/hooks/onCleanup.js';
import { useCordInternalOrThrow } from '../cordContext.js';

import { useCurrentRepliable } from './useCurrentRepliable.js';

const MAX_CUSTOM_ID_LENGTH = 100;
const MODAL_TIMEOUT_MS = 15 * 60 * 1_000;
const UUID_LENGTH = 36 + 1;

/**
 * Show a modal to the user. When submitted, runs all middleware and returns the
 * interaction.
 * @param definition
 */
export async function awaitModal(
  definition: ModalBuilder | ModalComponentData,
): Promise<ModalSubmitInteraction | null> {
  const legacy = getCurrentSynapseOrDefault();
  if (legacy) {
    return legacy.awaitModalSubmit(legacy.ctx.lastCollectedInteraction!, {
      time: MODAL_TIMEOUT_MS,
    });
  }

  const cord = useCordInternalOrThrow();

  let customId;
  let builder: ModalBuilder;
  if ('customId' in definition) {
    customId = definition.customId;
    builder = new ModalBuilder(definition);
  } else {
    customId = definition.data.custom_id;
    builder = ModalBuilder.from(definition);
  }

  const interaction = useCurrentRepliable();
  if (!interaction) {
    coreLog.warn('No interaction found to await modal on', {
      definition,
      customId,
    });
    return null;
  }
  if (interaction.isModalSubmit()) {
    coreLog.warn('Cannot show a modal on a modal submit interaction', {
      customId,
      interaction,
    });
    return null;
  }

  if (!customId) {
    // Use UUID directly
    customId = crypto.randomUUID();
  } else {
    if (customId.length + UUID_LENGTH > MAX_CUSTOM_ID_LENGTH) {
      customId = customId.slice(0, MAX_CUSTOM_ID_LENGTH - UUID_LENGTH);
    }
    customId += `_${crypto.randomUUID()}`;
  }

  let resolve!: (interaction: ModalSubmitInteraction | null) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<ModalSubmitInteraction | null>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  let timeoutId!: ReturnType<typeof setTimeout>;
  const unregister = cord.registerModal(customId, (modalSubmitInteraction) => {
    clearTimeout(timeoutId);
    unregister();
    resolve(cord.isDisposed() ? null : modalSubmitInteraction);
  });

  const cancel = () => {
    unregister();
    resolve(null);
  };
  timeoutId = setTimeout(cancel, MODAL_TIMEOUT_MS);
  onCleanup(cancel);

  try {
    await interaction.showModal(builder);
  } catch (error) {
    clearTimeout(timeoutId);
    unregister();
    reject(error);
  }

  return promise;
}
