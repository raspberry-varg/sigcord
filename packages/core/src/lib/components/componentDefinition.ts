import type {
  MappedInteractionTypes,
  MessageActionRowComponentBuilder,
} from "discord.js";

import type { MessageComponentCallback } from "./messageComponentCallback.js";

type InteractionFromBuilder<
  Builder extends MessageActionRowComponentBuilder,
  Cached extends boolean,
> = MappedInteractionTypes<Cached>[NonNullable<Builder["data"]["type"]>];

export interface ComponentDefinition<
  Builder extends MessageActionRowComponentBuilder,
  Cached extends boolean = boolean,
> {
  /**
   * Custom identifier for this component. Populated with a randomly generated
   * identifier if none is provided.
   *
   * **Note:** This will be prepended with the ViewId of the view it was generated
   *   from.
   */
  id?: string;
  /**
   * The component builder to be displayed to the user. The `customId` will be
   * autopopulated.
   */
  component: Builder;
  /**
   * Called when the {@link component} receives a user interaction.
   */
  handler: MessageComponentCallback<InteractionFromBuilder<Builder, Cached>>;
}
