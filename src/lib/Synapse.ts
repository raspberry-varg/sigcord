import type { ReactivelyParams, Reactive } from '@reactively/core';
import type {
  MessageActionRowComponentBuilder,
  MessageComponentInteraction,
  EmbedBuilder,
  ModalBuilder,
  AwaitModalSubmitOptions,
  ModalSubmitInteraction,
  CommandInteraction,
} from 'discord.js';
import type { MenuContext } from './FunctionalMenuView.js';
import type { MessageComponentCallback } from './MenuView.js';

type ModalRepliableInteraction =
  | CommandInteraction
  | MessageComponentInteraction;

/**
 * Closure functions to manage and interact with a bound menu instance.
 *
 * The `Synapse` is a collection of closure functions bound to a menu instance.
 * These act as the central nervous system for your interactive menus.
 */
export interface Synapse {
  /**
   * Configures a reactive message component.
   *
   * - Passed component id is auto-formatted to `menuId:viewId:componentId`.
   * - Calls the passed component builder's `setCustomId` with the provided id.
   * - Binds a given handler to a component via its id.
   * @returns The provided component builder.
   */
  component<
    ComponentType extends MessageActionRowComponentBuilder,
    ComponentInteractionType extends MessageComponentInteraction
  >(definition: {
    id: string;
    component: ComponentType;
    controller: MessageComponentCallback<ComponentInteractionType>;
  }): ComponentType;
  swap(toViewId: string, ...args: any[]): void;
  appendEmbeds(...embeds: EmbedBuilder[]): void;
  prependEmbeds(...embeds: EmbedBuilder[]): void;
  showModal(
    interaction: ModalRepliableInteraction,
    modal: ModalBuilder
  ): Promise<void>;
  awaitModalSubmit(
    interaction: ModalRepliableInteraction,
    options: AwaitModalSubmitOptions<ModalSubmitInteraction>
  ): Promise<ModalSubmitInteraction<import('discord.js').CacheType> | null>;
  onModalSubmit(
    interaction: ModalRepliableInteraction,
    options: AwaitModalSubmitOptions<ModalSubmitInteraction>,
    callback: (collected: ModalSubmitInteraction) => unknown
  ): Promise<void>;
  setIdleMs(idleMilliseconds: number): void;
  setIdleSec(idleSeconds: number): void;
  close: () => Promise<void>;
  stop: (reason?: string) => void;
  queueRender: () => void;
  skipRender: () => void;
  createSignal: <T>(
    fnOrValue: T | (() => T),
    params?: ReactivelyParams
  ) => Reactive<T>;
  createEffect: <T>(
    fn: () => T,
    params?: Omit<ReactivelyParams, 'effect'>
  ) => void;
  ctx: MenuContext;
}
