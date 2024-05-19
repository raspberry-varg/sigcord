import type {
  ActionRowBuilder,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
} from 'discord.js';
import { resolveMaybeFunction, type MaybeClosure } from '../util/TypesUtil';

export type ViewPayload = {
  [K in keyof ViewPayloadResolved]: MaybeClosure<
    Required<ViewPayloadResolved[K]>
  >;
};

export interface ViewPayloadResolved {
  ephemeral?: boolean;
  content?: string;
  embeds?: EmbedBuilder[];
  components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

export interface MessageComponentCallback<
  T extends MessageComponentInteraction = MessageComponentInteraction
> {
  (callback: T): Promise<unknown> | unknown;
}

export interface IntrinsicViewProps {
  ephemeral: boolean | false;
}

export async function resolveViewPayload(
  payload: ViewPayload
): Promise<ViewPayloadResolved> {
  const resolved: Record<string, unknown> = { ...payload };
  for (const key of Object.keys(payload) as Array<keyof ViewPayload>) {
    resolved[key] = await resolveMaybeFunction(resolved[key]);
  }
  return resolved;
}
