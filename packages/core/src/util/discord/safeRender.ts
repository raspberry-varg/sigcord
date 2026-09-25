import {
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  type Message,
  RepliableInteraction,
} from 'discord.js';

import { ViewMessagePayload } from '../../lib/views/viewFlavors.js';

import type { Payload } from '../../framework/payload.js';

export interface SafeRenderOptions {
  preferReplyForComponent?: boolean;
  initialMessage?: Message;
  retrieveMessage?: boolean;
}

export async function safeRender(
  renderTarget: RepliableInteraction,
  viewPayload: Readonly<Payload | ViewMessagePayload>,
  options: SafeRenderOptions = {},
): Promise<Message | undefined> {
  let message: Message | undefined = undefined;

  if (options.initialMessage) {
    (viewPayload as InteractionEditReplyOptions).message = options.initialMessage;
    message = options.initialMessage;
  }

  if (options.retrieveMessage) {
    (viewPayload as InteractionReplyOptions).withResponse = true;
  }

  if (renderTarget.replied || renderTarget.deferred) {
    if (options.preferReplyForComponent) {
      message = await renderTarget.followUp(viewPayload as InteractionReplyOptions);
    } else {
      message = await renderTarget.editReply(viewPayload as InteractionEditReplyOptions);
    }
  } else if (renderTarget.isMessageComponent()) {
    if (options.preferReplyForComponent) {
      const response = await renderTarget.reply({
        ...viewPayload,
      } as InteractionReplyOptions & { withResponse: true });
      message = response.resource?.message ?? undefined;
    } else {
      const response = await renderTarget.update({
        ...viewPayload,
      } as InteractionUpdateOptions & { withResponse: true });
      message = response.resource?.message ?? undefined;
    }
  }

  // handle new replies
  if (!message && options.retrieveMessage) {
    const response = await renderTarget.reply({
      ...viewPayload,
    } as InteractionReplyOptions & { withResponse: true });
    message = response.resource?.message ?? undefined;
  }

  return message;
}
