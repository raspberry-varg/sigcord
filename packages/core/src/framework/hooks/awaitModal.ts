import { useContext } from '../../lib/contexts/useContext.js';
import { CordContext } from '../cordContext.js';
import { getCurrentSynapse } from '../../lib/builtins/builtins.js';
import {
  ModalBuilder,
  type ModalComponentData,
  type ModalSubmitInteraction,
} from 'discord.js';
import * as crypto from 'crypto';
import type { ModalRepliableInteraction } from '../../lib/interactivity/modalHandling.js';
import { onCleanup } from '../../lib/hooks/onCleanup.js';

const MAX_CUSTOM_ID_LENGTH = 100;
const MODAL_TIMEOUT_MS = 15 * 60 * 1_000;
const UUID_LENGTH = 36 + 1;

/**
 * Show a modal to the user. When submitted, runs all middleware and returns the
 * interaction.
 * @param interaction
 * @param definition
 */
export async function awaitModal(
  interaction: ModalRepliableInteraction,
  definition: ModalBuilder | ModalComponentData,
): Promise<ModalSubmitInteraction | null> {
  const cord = useContext(CordContext);
  if (!cord) {
    // Fall back to the legacy awaitModal
    return getCurrentSynapse().awaitModalSubmit(interaction, {
      time: MODAL_TIMEOUT_MS,
    });
  }

  let customId;
  let builder: ModalBuilder;
  if ('customId' in definition) {
    customId = definition.customId;
    builder = new ModalBuilder(definition);
  } else {
    customId = definition.data.custom_id;
    builder = ModalBuilder.from(definition);
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
