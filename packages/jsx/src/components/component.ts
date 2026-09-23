import { type ComponentDefinition, component } from '@sigcord/core';

import type { MessageActionRowComponentBuilder } from 'discord.js';

/**
 * @deprecated Please use {@link import('@sigcord/core').useComponentHandler} instead.
 *
 * JSX wrapper over the {@link component} primitive.
 *
 * Useful for making custom components.
 */
export function Component<
  Builder extends MessageActionRowComponentBuilder,
  Cached extends boolean = boolean,
>(props: ComponentDefinition<Builder, Cached>) {
  return component(props);
}
