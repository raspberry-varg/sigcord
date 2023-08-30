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
import type { ModalBundle } from './ModalBundle';

type MenuViewComponentId = string;
type ModalRepliableInteraction =
  | CommandInteraction
  | MessageComponentInteraction;

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

  prePassEmbedsToNextRender(...embeds: EmbedBuilder[]) {
    this.preEmbeds.push(...embeds);
  }

  postPassEmbedsToNextRender(...embeds: EmbedBuilder[]) {
    this.postEmbeds.push(...embeds);
  }

  passEmbedsToNextRender(...embeds: EmbedBuilder[]) {
    this.passedEmbeds.push(...embeds);
  }

  /**
   * **DO NOT OVERRIDE**. Pass a collected interaction from the InteractiveMenu
   * to its respective listener.
   * @internal
   */
  __passCollectedInteractionToHandler(collected: CollectedMessageInteraction) {
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
    const embeds = [...(this.embeds() ?? []), ...this.pullEmbedsToPass()];
    return {
      embeds,
      ephemeral: this.ephemeral,
      content: this.content(),
      components: this.components(),
    };
  }

  async triggerPreloads() {
    if (!this.onLoad) return;
    return this.onLoad();
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
    interaction: ModalRepliableInteraction,
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

  protected async onModalSubmit(
    interaction: ModalRepliableInteraction,
    options: AwaitModalSubmitOptions<ModalSubmitInteraction>,
    callback: (collected: ModalSubmitInteraction) => unknown
  ) {
    const response = await this.awaitModalSubmit(interaction, options);
    if (!response) return;
    return callback(response);
  }

  protected async executeModalBundle<Props>(
    interaction: ModalRepliableInteraction,
    modalBundle: ModalBundle<Props>,
    props: Props
  ) {
    const modalBundleInstance = modalBundle(props);
    await interaction.showModal(modalBundleInstance.getModal());
    return this.onModalSubmit(
      interaction,
      modalBundleInstance.getSubmitOptions(),
      modalBundleInstance.getSubmitHandler()
    );
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
