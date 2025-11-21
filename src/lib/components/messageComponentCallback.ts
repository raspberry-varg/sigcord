import type {
  ButtonInteraction,
  MessageComponentInteraction,
} from 'discord.js';

/**
 * Callback for a given interaction.
 */
export type MessageComponentCallback<
  T extends MessageComponentInteraction = MessageComponentInteraction,
> = (callback: T) => Promise<unknown> | unknown;

interface MessageComponentTypeToCallbackMap {
  button: ButtonInteraction;
}

export type MessageComponentCallbackFor<
  T extends keyof MessageComponentTypeToCallbackMap,
> = MessageComponentCallback<MessageComponentTypeToCallbackMap[T]>;
