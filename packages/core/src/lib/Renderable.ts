import {
  MessageFlags,
  type ActionRowBuilder,
  type EmbedBuilder,
  type Message,
  type MessageActionRowComponentBuilder,
  type RepliableInteraction,
} from 'discord.js';
import { safeRender } from '../util/RenderingUtil.js';
import { ViewMessagePayload } from './views/viewFlavors.js';

interface RenderOptions {
  flags?: MessageFlags;
  replyToComponentOnFirstRender: boolean;
}

export class Renderable {
  public message?: Message;

  constructor(
    public interaction: RepliableInteraction,
    private readonly options: RenderOptions = {
      flags: MessageFlags.Ephemeral,
      replyToComponentOnFirstRender: false,
    },
  ) {}

  async triggerPreloads() {
    if (!this.onLoad) return;
    return this.onLoad();
  }

  messagePayload(): ViewMessagePayload {
    return {
      flags: this.options.flags,
      embeds: this.embeds(),
      content: this.content(),
      components: this.components(),
    };
  }
  protected content(): string | undefined {
    return undefined;
  }
  protected embeds(): EmbedBuilder[] | undefined {
    return undefined;
  }
  protected components():
    | ActionRowBuilder<MessageActionRowComponentBuilder>[]
    | undefined {
    return undefined;
  }
  protected async onLoad(): Promise<unknown> {
    return undefined;
  }

  public async render() {
    await this.triggerPreloads();

    this.message = await safeRender(
      this.interaction,
      this.messagePayload(),
      /* props= */ undefined,
      /* preferReplyForComponent= */ this.options.replyToComponentOnFirstRender,
    );

    this.options.replyToComponentOnFirstRender = false;
    return this.message;
  }
}
