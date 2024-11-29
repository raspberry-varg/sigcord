import { ViewMessagePayload } from '../lib/MenuView.js';
import { TimeoutEmbed } from '../lib/PrebuiltEmbeds.js';
import { RepliableInteraction } from 'discord.js';

export function appendTimeoutEmbed(payload: ViewMessagePayload) {
  payload.embeds = [...(payload.embeds ?? []).splice(0, 10), TimeoutEmbed];
  return payload;
}

export async function safeRender(
  renderTarget: RepliableInteraction,
  viewPayload: ViewMessagePayload,
  preferReplyForComponent = false,
) {
  let message;

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
