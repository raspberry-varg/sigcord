import type {
  ActionRowBuilder,
  EmbedBuilder,
  Message,
  MessageActionRowComponentBuilder,
  RepliableInteraction,
} from 'discord.js';
import { safeRender } from '../util/RenderingUtil.js';
import { ViewPayload } from './MenuView.js';

interface RenderOptions {
  ephemeral: boolean;
  replyToComponentOnFirstRender: boolean;
}

export class Renderable {
  public message?: Message;

  constructor(
    public interaction: RepliableInteraction,
    private readonly options: RenderOptions = {
      ephemeral: true,
      replyToComponentOnFirstRender: false,
    }
  ) {}

  async triggerPreloads() {
    if (!this.onLoad) return;
    return this.onLoad();
  }

  messagePayload(): ViewPayload {
    return {
      embeds: this.embeds(),
      ephemeral: this.options.ephemeral,
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
      this.options.replyToComponentOnFirstRender
    );
    this.options.replyToComponentOnFirstRender = false;
    return this.message;
  }
}
