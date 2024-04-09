/**
 * Functional implementation of Menu Views.
 */

import type {
  AwaitModalSubmitOptions,
  CommandInteraction,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  RepliableInteraction,
} from 'discord.js';
import type { MessageComponentCallback, ViewPayload } from './MenuView';
import { MaybePromise } from '../util/TypesUtil';

type PropsBase = NonNullable<unknown>;
type ModalRepliableInteraction =
  | CommandInteraction
  | MessageComponentInteraction;

interface ViewDefinitionBase {
  readonly id: string;
}

type ViewClosureReturn<Props extends PropsBase = PropsBase> = MaybePromise<
  ViewBody<Props>
>;

interface ViewClosureBody<Props extends PropsBase = PropsBase> {
  closure: ViewClosure<Props>;
}

export type ViewClosureDefinition<Props extends PropsBase = PropsBase> =
  ViewDefinitionBase & ViewClosureBody<Props>;

export type ViewClosure<Props extends PropsBase = PropsBase> =
  () => ViewClosureReturn<Props>;

export interface ViewBody<Props extends PropsBase = PropsBase> {
  onSwap?: (...args: any[]) => MaybePromise<void>;
  render: ViewRender<Props>;
}

export type ViewDefinition<Props extends PropsBase = PropsBase> =
  ViewDefinitionBase & ViewBody<Props>;

export type View<Props extends PropsBase = PropsBase> =
  | ViewClosureDefinition<Props>
  | ViewDefinition<Props>;

export type ViewRender<Props extends PropsBase = PropsBase> = (
  props: ViewProps<Props>
) => MaybePromise<ViewPayload>;

export type ViewInstance<Props extends PropsBase = PropsBase> =
  ViewDefinition<Props>;

interface MenuContext {
  interaction: RepliableInteraction;
}

export interface ViewBuiltins {
  $component<
    ComponentType extends MessageActionRowComponentBuilder,
    ComponentInteractionType extends MessageComponentInteraction
  >(definition: {
    id: string;
    component: ComponentType;
    callback: MessageComponentCallback<ComponentInteractionType>;
  }): ComponentType;
  $swap(toViewId: string, ...args: any[]): void;
  $appendEmbeds(...embeds: EmbedBuilder[]): void;
  $prependEmbeds(...embeds: EmbedBuilder[]): void;
  $showModal(
    interaction: ModalRepliableInteraction,
    modal: ModalBuilder
  ): Promise<void>;
  $awaitModalSubmit(
    interaction: ModalRepliableInteraction,
    options: AwaitModalSubmitOptions<ModalSubmitInteraction>
  ): Promise<ModalSubmitInteraction<import('discord.js').CacheType> | null>;
  $onModalSubmit(
    interaction: ModalRepliableInteraction,
    options: AwaitModalSubmitOptions<ModalSubmitInteraction>,
    callback: (collected: ModalSubmitInteraction) => unknown
  ): Promise<void>;
  $close: () => void;
}

export type ViewProps<
  Props extends NonNullable<unknown> = NonNullable<unknown>
> = Props & ViewBuiltins & { ctx: MenuContext } & { $: ViewProps<Props> };

export function DefineView<Props extends PropsBase = PropsBase>(
  id: string,
  definition: ViewClosure<Props> | ViewBody<Props>
): View<Props> {
  return {
    ...(typeof definition === 'function'
      ? { closure: definition }
      : definition),
    id,
  };
}

/** @internal */
export async function instantiateViewFromClosure<
  Props extends PropsBase = PropsBase
>(view: ViewClosureDefinition<Props>): Promise<ViewInstance<Props>> {
  const body = await view.closure();
  return {
    ...body,
    id: view.id,
  };
}
