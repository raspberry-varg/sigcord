import type {
  ActionRowBuilder,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
} from 'discord.js';
import type { Signal } from '../index.js';

type Component = ActionRowBuilder<MessageActionRowComponentBuilder>;

export interface RenderedReactiveViewPayload {
  ephemeral?: boolean;
  content?: string | Signal<string>;
  embeds?: EmbedBuilder[] | Signal<EmbedBuilder[]>;
  components?: Component[] | Signal<Component[]>;
}

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
