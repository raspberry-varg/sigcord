import type { Message, RepliableInteraction } from 'discord.js';
import type { ViewPayload } from './MenuView';
import { safeRender } from '../util/RenderingUtil';
import type { RenderOptions } from './MenuController';
import type { IntrinsicMenuProps } from './InteractiveMenu';

export class InteractionPatcher {
  message?: Message;

  constructor(
    public interaction: RepliableInteraction,
    private readonly props: Readonly<IntrinsicMenuProps>
  ) {}

  mountInteraction(interaction: RepliableInteraction): void {
    this.interaction = interaction;
  }

  async patch(payload: ViewPayload, options: Partial<RenderOptions>) {
    this.message = await safeRender(
      this.interaction,
      { ...this.props, ...payload },
      options.forceReply
    );
  }

  async delete() {
    return await this.interaction.deleteReply();
  }
}
