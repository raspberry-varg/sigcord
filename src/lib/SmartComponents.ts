import { ButtonBuilder, ButtonStyle } from 'discord.js';

export enum SmartComponentType {
  CloseButton = '__RESERVED__Close',
}

/**
 * `Button` that triggers the parent `InteractiveMenu` to close.
 */
export const SmartCloseButton = new ButtonBuilder({
  custom_id: SmartComponentType.CloseButton,
  style: ButtonStyle.Secondary,
  label: 'Close',
});
