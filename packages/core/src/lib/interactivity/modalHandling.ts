import type {
  CommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  AwaitModalSubmitOptions,
  ModalBuilder,
} from 'discord.js';

export type ModalRepliableInteraction =
  | CommandInteraction
  | MessageComponentInteraction;

export type ModalOnSubmitHandler = (
  modal: ModalSubmitInteraction,
) => void | Promise<void>;

export interface ModalHandlingOptions extends AwaitModalSubmitOptions<ModalSubmitInteraction> {
  modal: ModalBuilder;
  onSubmit: ModalOnSubmitHandler;
}
