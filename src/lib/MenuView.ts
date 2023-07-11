import type {
  ActionRowBuilder,
  AwaitModalSubmitOptions,
  CollectedMessageInteraction,
  CommandInteraction,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import type { Router } from './Router';

type MenuViewComponentId = string;

export interface MenuViewPayload {
  ephemeral: boolean;
  content?: string;
  embeds?: EmbedBuilder[];
  components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

export interface MessageComponentCallback<
  T extends MessageComponentInteraction = MessageComponentInteraction
> {
  (callback: T): Promise<unknown>;
}

export abstract class MenuView<
  MenuProps extends NonNullable<unknown> = NonNullable<unknown>
> {
  abstract readonly id: string;
  private readonly messageComponentCallbacks: Map<
    MenuViewComponentId,
    MessageComponentCallback
  >;
  private passedEmbeds: EmbedBuilder[];
  private postEmbeds: EmbedBuilder[];
  private preEmbeds: EmbedBuilder[];
  private latestModalOpenedInteractionId?: string;

  constructor(
    protected readonly router: Router,
    protected readonly props: MenuProps,
    private readonly ephemeral: boolean = true
  ) {
    this.messageComponentCallbacks = new Map();
    this.passedEmbeds = [];
    this.postEmbeds = [];
    this.preEmbeds = [];
  }

  PrePassEmbedsToNextRender(...embeds: EmbedBuilder[]) {
    this.preEmbeds.push(...embeds);
  }

  PostPassEmbedsToNextRender(...embeds: EmbedBuilder[]) {
    this.postEmbeds.push(...embeds);
  }

  PassEmbedsToNextRender(...embeds: EmbedBuilder[]) {
    this.passedEmbeds.push(...embeds);
  }

  /**
   * **DO NOT OVERRIDE**. Pass a collected interaction from the InteractiveMenu
   * to its respective listener.
   */
  _passCollectedInteractionToHandler(collected: CollectedMessageInteraction) {
    const interactionCallback = this.messageComponentCallbacks.get(
      collected.customId
    );
    if (!interactionCallback) {
      console.warn(
        `MenuView: No handler defined for ${this.getComponentId(
          collected.customId
        )}`
      );
      return Promise.resolve('No handler defined.');
    }
    return interactionCallback(collected);
  }

  messagePayload(): MenuViewPayload {
    const embeds = [
      ...(this.embeds ? this.embeds() ?? [] : []),
      ...this.pullEmbedsToPass(),
    ];
    return {
      embeds,
      ephemeral: this.ephemeral,
      content: this.content ? this.content() : undefined,
      components: this.components ? this.components() : undefined,
    };
  }

  async triggerPreloads() {
    if (!this.onLoad) return;
    return this.onLoad();
  }

  protected content?: () => string | undefined;
  protected embeds?: () => EmbedBuilder[] | undefined;
  protected components?: () =>
    | ActionRowBuilder<MessageActionRowComponentBuilder>[]
    | undefined;
  protected onLoad?: () => Promise<unknown>;

  protected createMessageComponentId(componentId: string): MenuViewComponentId {
    if (componentId.includes(':')) {
      throw new MenuViewComponentError(
        `Internal delimiter uses ':' for MenuViewComponentIds. Please use ` +
          `a different character.`
      );
    }
    return `${this.router.parentId()}:${this.id}:${componentId}`;
  }

  protected getComponentId(rawCustomId: string) {
    const componentIdSplit = rawCustomId.split(':');
    if (componentIdSplit.length !== 3) {
      throw new MenuViewComponentError(
        `customId for '${rawCustomId}' is malformed. Please use ` +
          `'createMessageComponentId()' when defining a new component id.`
      );
    }
  }

  protected setComponentListener(
    componentId: MenuViewComponentId,
    callback: MessageComponentCallback
  ) {
    this.assertComponentIdFormat(componentId);
    this.messageComponentCallbacks.set(componentId, callback);
  }

  onInteract = this.setComponentListener;

  /**
   * Safely await a ModalSubmitInteraction by only returning a response if
   * no other modal is currently being awaited.
   */
  protected async awaitModalSubmit(
    interaction: CommandInteraction | MessageComponentInteraction,
    options: AwaitModalSubmitOptions<ModalSubmitInteraction>
  ) {
    this.latestModalOpenedInteractionId = interaction.id;
    const response = await interaction.awaitModalSubmit(options).catch(() => {
      console.log('Modal ended without receiving a response');
      return null;
    });
    if (!response || this.latestModalOpenedInteractionId !== interaction.id)
      return null;

    return response;
  }

  private assertComponentIdFormat(
    rawComponentId: string
  ): asserts rawComponentId is MenuViewComponentId {
    if (rawComponentId.split(':').length !== 3) {
      throw new MenuViewComponentError(
        `${rawComponentId} is malformed. Use 'createMessageComponentId' for ` +
          `all MessageComponent customIds.`
      );
    }
  }

  private pullEmbedsToPass() {
    const embeds = [
      ...this.preEmbeds,
      ...this.passedEmbeds,
      ...this.postEmbeds,
    ];

    this.preEmbeds = [];
    this.passedEmbeds = [];
    this.postEmbeds = [];
    return embeds;
  }
}

class MenuViewComponentError extends Error {
  constructor(message: string) {
    super(message);
  }
}
