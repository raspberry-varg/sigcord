import {
  ActionRowBuilder,
  AwaitModalSubmitOptions,
  CollectedMessageInteraction,
  CommandInteraction,
  EmbedBuilder,
  MessageActionRowComponentBuilder, MessageComponentInteraction,
  ModalSubmitInteraction, RepliableInteraction
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

export interface IntrinsicViewProps {
  ephemeral: boolean | false;
}

const DefaultProps: IntrinsicViewProps = {
  ephemeral: false,
} as const;

export class MenuView<ViewProps extends NonNullable<unknown> = NonNullable<unknown>> {
  readonly id: string = this.constructor.prototype.name;
  readonly props: ViewProps & IntrinsicViewProps;
  private passedEmbeds: EmbedBuilder[];
  private postEmbeds: EmbedBuilder[];
  private preEmbeds: EmbedBuilder[];
  private latestModalOpenedInteractionId?: string;
  private readonly messageComponentCallbacks: Map<
    MenuViewComponentId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MessageComponentCallback<any>
  >;
  private readonly __router?: Router;

  constructor(props: ViewProps & Partial<IntrinsicViewProps>) {
    this.props = Object.assign({...DefaultProps}, props);
    this.messageComponentCallbacks = new Map();
    this.passedEmbeds = [];
    this.postEmbeds = [];
    this.preEmbeds = [];
  }

  get router(): Router {
    if (this.__router === undefined) {
      throw new Error(`Internal: Router has not been defined.`);
    }
    return this.__router;
  }

  get interaction(): RepliableInteraction {
    return this.router.getParent().interaction;
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
   * Called when this view comes into view.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public onSwap(..._args: unknown[]) {
    return;
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
      ephemeral: this.props.ephemeral,
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

  /**
   * @brief Create a component with a callback.
   * 
   * @description
   * Utility method that creates a message component id tied to this view, attaches it to the component, and registers
   * a provided callback to it.
   */
  protected createSmartComponent<ComponentType extends MessageActionRowComponentBuilder, ComponentInteractionType extends MessageComponentInteraction>(
    componentId: string, componentBuilder: ComponentType, componentCallback: MessageComponentCallback<ComponentInteractionType>,
  ): ComponentType {
    const componentClassId = this.createMessageComponentId(componentId);
    componentBuilder.setCustomId(componentClassId);
    this.setComponentListener(componentClassId, componentCallback);
    return componentBuilder;
  }

  protected createMessageComponentId(componentId: string): MenuViewComponentId {
    if (componentId.includes(':')) {
      throw new MenuViewComponentError(
        `Internal delimiter uses ':' for MenuViewComponentIds. Please use ` +
          `a different character.`
      );
    }
    return `${this.router.parentId}:${this.id}:${componentId}`;
  }

  protected getComponentId(rawCustomId: string) {
    const componentIdSplit = rawCustomId.split(':');
    if (componentIdSplit.length !== 3) {
      throw new MenuViewComponentError(
        `customId for '${rawCustomId}' is malformed. Please use ` +
          `'createMessageComponentId()' when defining a new component id.`
      );
    }
    return componentIdSplit.at(-1);
  }

  protected setComponentListener<ComponentInteractionType extends MessageComponentInteraction>(
    componentId: MenuViewComponentId,
    callback: MessageComponentCallback<ComponentInteractionType>
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
