import { type AnyComponent, ComponentType } from 'discord.js';

export function isDiscordAPIComponentType<T extends ComponentType>(
  x: unknown,
  type: T,
): x is AnyComponent & { type: T } {
  return x != null && typeof x === 'object' && 'type' in x && x.type === type;
}
