import { MenuViewPayload } from '../lib/MenuView';
import { TimeoutEmbed } from '../lib/PrebuiltEmbeds';
import { RepliableInteraction } from 'discord.js';

export function appendTimeoutEmbed(
  payload: MenuViewPayload,
  endReason?: string | null
) {
  payload.embeds = [
    ...(payload.embeds ?? []).splice(0, 10),
    TimeoutEmbed(endReason),
  ];
}

export async function safeRender(
  renderTarget: RepliableInteraction,
  viewPayload: MenuViewPayload,
  preferReplyForComponent = false
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
