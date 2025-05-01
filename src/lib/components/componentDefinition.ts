import type {
  MessageActionRowComponentBuilder,
  MappedInteractionTypes,
} from 'discord.js';
import type { MessageComponentCallback } from '../MenuController.js';

type InteractionFromBuilder<
  Builder extends MessageActionRowComponentBuilder,
  Cached extends boolean,
> = MappedInteractionTypes<Cached>[NonNullable<Builder['data']['type']>];

export type ComponentDefinition<
  Builder extends MessageActionRowComponentBuilder,
  Cached extends boolean,
> =
  | ComponentWithHandler<Builder, Cached>
  | ComponentDefinitionLegacy<Builder, Cached>;

interface ComponentDefinitionBase<
  Builder extends MessageActionRowComponentBuilder,
> {
  id: string;
  component: Builder;
}

interface ComponentWithHandler<
  Builder extends MessageActionRowComponentBuilder,
  Cached extends boolean,
> extends ComponentDefinitionBase<Builder> {
  handler: MessageComponentCallback<InteractionFromBuilder<Builder, Cached>>;
}

interface ComponentDefinitionLegacy<
  Builder extends MessageActionRowComponentBuilder,
  Cached extends boolean,
> extends ComponentDefinitionBase<Builder> {
  /**
   * @deprecated Please use the 'handler' property instead. This will soon
   *   become a field for a full controller class for the component itself.
   */
  controller: MessageComponentCallback<InteractionFromBuilder<Builder, Cached>>;
}
