/**
 * Functional implementation of Menu Views.
 */

import type {
  ActionRowBuilder,
  AwaitModalSubmitOptions,
  CommandInteraction,
  EmbedBuilder,
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  RepliableInteraction,
} from 'discord.js';
import type { MessageComponentCallback } from './MenuView';
import { MaybePromise } from '../util/TypesUtil';

type PropsBase = NonNullable<unknown>;
type ModalRepliableInteraction =
  | CommandInteraction
  | MessageComponentInteraction;

export interface View<Props extends PropsBase = PropsBase> {
  readonly id: string;
  onLoad?: (props: ViewProps<Props>) => MaybePromise<void>;
  onSwap?: (...args: any[]) => MaybePromise<void>;
  render: ViewRender<Props>;
}

export type ViewRender<Props extends PropsBase = PropsBase> = (
  props: ViewProps<Props>
) => MaybePromise<ViewPayload>;

export type OnLoadCallback = () => MaybePromise<void>;

interface MenuContext {
  interaction: RepliableInteraction;
}

interface ViewPayload {
  ephemeral?: boolean;
  content?: string;
  embeds?: EmbedBuilder[];
  components?: ActionRowBuilder<MessageActionRowComponentBuilder>[];
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
  $swap(toViewId: string): void;
  $appendEmbeds(...embeds: EmbedBuilder[]): void;
  $prependEmbeds(...embeds: EmbedBuilder[]): void;
  $showModal(interaction: ModalRepliableInteraction, modal: ModalBuilder): Promise<void>;
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
  // $onLoad(callback: OnLoadCallback): void;
}

export type ViewProps<
  Props extends NonNullable<unknown> = NonNullable<unknown>
> = Props & ViewBuiltins & { ctx: MenuContext } & { $: ViewProps<Props> };

export interface InternalViewContext {
  // onLoadCallbacks: OnLoadCallback[];
  appendedEmbeds: EmbedBuilder[];
  prependedEmbeds: EmbedBuilder[];
  smartComponents: Map<string, { component: any; callback: any }>;
  queuedViewChange: string | null;
}

export function DefineView<
  Props extends NonNullable<unknown> = NonNullable<unknown>
>(definition: View<Props>): View<Props> {
  return {...definition} as const;
}
