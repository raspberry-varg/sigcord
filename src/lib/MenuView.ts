import type {
  ActionRowBuilder,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
} from 'discord.js';

type Component = ActionRowBuilder<MessageActionRowComponentBuilder>;

export interface ReactiveViewPayload {
  ephemeral?: boolean;
  content?: string | (() => string);
  embeds?: EmbedBuilder[] | (() => EmbedBuilder[]);
  components?: Component[] | (() => Component[]);
}

export interface ViewPayload {
  ephemeral?: boolean;
  content?: string;
  embeds?: EmbedBuilder[];
  components?: Component[];
}

export interface MessageComponentCallback<
  T extends MessageComponentInteraction = MessageComponentInteraction
> {
  (callback: T): Promise<unknown> | unknown;
}

export interface IntrinsicViewProps {
  ephemeral: boolean | false;
}
