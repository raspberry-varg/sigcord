import type {MessageActionRowComponentBuilder} from 'discord.js';

import {type ComponentDefinition, component} from '@sigcord/core';

/**
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
