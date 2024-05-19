import {
  ViewPayloadResolved,
  resolveViewPayload,
  type ViewPayload,
} from '../lib/MenuView';
import { TimeoutEmbed } from '../lib/PrebuiltEmbeds';
import { RepliableInteraction } from 'discord.js';

export function appendTimeoutEmbed(payload: ViewPayloadResolved) {
  payload.embeds = [...(payload.embeds ?? []).splice(0, 10), TimeoutEmbed];
  return payload;
}

export async function safeRender(
  renderTarget: RepliableInteraction,
  viewPayloadRaw: ViewPayload,
  preferReplyForComponent = false
) {
  let message;
  const viewPayload = await resolveViewPayload(viewPayloadRaw);

  if (renderTarget.replied || renderTarget.deferred) {
    message = await renderTarget.editReply(viewPayload);
  } else if (renderTarget.isMessageComponent()) {
    if (preferReplyForComponent) {
      message = await renderTarget.reply({
        ...viewPayload,
        fetchReply: true,
      });
    } else {
      message = await renderTarget.update({
        ...viewPayload,
        fetchReply: true,
      });
    }
  }

  // handle new replies
  if (!message) {
    message = await renderTarget.reply({
      ...viewPayload,
      fetchReply: true,
    });
  }

  return message;
}
