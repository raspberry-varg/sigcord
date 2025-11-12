import type { Message, RepliableInteraction } from 'discord.js';
import type { ViewMessagePayload } from '../../views/viewFlavors.js';
import { safeRender } from '../../../util/RenderingUtil.js';
import type { RenderOptions } from './menuInstance.js';
import type { IntrinsicMenuProps } from '../defineMenu.js';
import { logger } from '../../../util/Logger.js';

export class InteractionPatcher {
  message?: Message;

  constructor(
    public interaction: RepliableInteraction,
    private readonly props: Readonly<IntrinsicMenuProps>,
  ) {}

  mountInteraction(interaction: RepliableInteraction): void {
    this.interaction = interaction;
  }

  async patch(payload: ViewMessagePayload, options: Partial<RenderOptions>) {
    logger.info(
      `Patching interaction.id=${this.interaction.id} with the following payload: `,
      payload,
    );
    this.message = await safeRender(
      this.interaction,
      payload,
      this.props,
      options.forceReply,
    );
  }

  async delete() {
    return await this.interaction.deleteReply();
  }
}
