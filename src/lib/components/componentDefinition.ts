import type {
  MappedInteractionTypes,
  MessageActionRowComponentBuilder,
} from 'discord.js';
import type { Synapse } from '../menu/instance/synapse.js';
import type { asyncBoundary } from '../builtins/builtins.js';
import type { MessageComponentCallback } from './messageComponentCallback.js';

type InteractionFromBuilder<
  Builder extends MessageActionRowComponentBuilder,
  Cached extends boolean,
> = MappedInteractionTypes<Cached>[NonNullable<Builder['data']['type']>];

export type ComponentDefinition<
  Builder extends MessageActionRowComponentBuilder,
  Cached extends boolean = boolean,
> =
  | ComponentWithHandler<Builder, Cached>
  | ComponentWithController<Builder, Cached>;

interface ComponentDefinitionBase<
  Builder extends MessageActionRowComponentBuilder,
> {
  /**
   * Custom identifier for this component. Populated with a randomly-generated
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
}

export interface ComponentWithHandler<
  Builder extends MessageActionRowComponentBuilder,
  Cached extends boolean = boolean,
> extends ComponentDefinitionBase<Builder> {
  /**
   * Called when the {@link component} receives a user interaction.
   *
   * **Warning:** Reactive hooks rely on the single-threaded nature of JS. If
   *   you foresee asynchronous operations (`await`/`.then(() => {})), store the
   *   current reactive context {@link Synapse} in a captured variable. You may
   *   also use the {@link asyncBoundary} hook, but it is now deprecated.
   *
   *   See {@link asyncBoundary}'s deprecated field to see synchronous
   *   alternatives to avoid returning a promise.
   */
  handler: MessageComponentCallback<InteractionFromBuilder<Builder, Cached>>;
}

export interface ComponentWithController<
  Builder extends MessageActionRowComponentBuilder,
  Cached extends boolean = boolean,
> extends ComponentDefinitionBase<Builder> {
  /**
   * @deprecated Please use the 'handler' property instead. This will soon
   *   become a field for a full controller class for the component itself.
   *   Currently, functions the same as {@link ComponentWithHandler.handler}.
   */
  controller: MessageComponentCallback<InteractionFromBuilder<Builder, Cached>>;
}
