import type { IntrinsicMenuProps } from '../lib/menu/defineMenu.js';
import {
  ViewMessagePayload,
  type IntrinsicViewProps,
} from '../lib/views/viewFlavors.js';
import { TimeoutEmbed } from '../lib/PrebuiltEmbeds.js';
import {
  MessageFlags,
  RepliableInteraction,
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  type Message,
} from 'discord.js';

export function appendTimeoutEmbed(payload: ViewMessagePayload) {
  payload.embeds = [...(payload.embeds ?? []).splice(0, 10), TimeoutEmbed];
  return payload;
}

export async function safeRender(
  renderTarget: RepliableInteraction,
  viewPayload: Readonly<ViewMessagePayload>,
  props: (IntrinsicMenuProps & IntrinsicViewProps) | undefined,
  preferReplyForComponent = false,
): Promise<Message> {
  let message: Message | null = null;

  let flags: MessageFlags | undefined = props?.flags;
  if (viewPayload.flags) {
    flags = (flags ?? 0) | viewPayload.flags;
  }

  if (viewPayload.ephemeral || props?.ephemeral) {
    flags = (flags ?? 0) | MessageFlags.Ephemeral;
    viewPayload = { ...viewPayload, ephemeral: undefined };
  }

  if (flags) {
    viewPayload = { ...viewPayload, flags };
  }

  if (renderTarget.replied || renderTarget.deferred) {
    message = await renderTarget.editReply(
      viewPayload as InteractionEditReplyOptions,
    );
  } else if (renderTarget.isMessageComponent()) {
    if (preferReplyForComponent) {
      const response = await renderTarget.reply({
        ...viewPayload,
        withResponse: true,
      } as InteractionReplyOptions & { withResponse: true });
      message = response.resource?.message!;
    } else {
      const response = await renderTarget.update({
        ...viewPayload,
        withResponse: true,
      } as InteractionUpdateOptions & { withResponse: true });
      message = response.resource?.message!;
    }
  }

  // handle new replies
  if (!message) {
    const response = await renderTarget.reply({
      ...viewPayload,
      withResponse: true,
    } as InteractionReplyOptions & { withResponse: true });
    message = response.resource?.message!;
  }

  return message;
}
