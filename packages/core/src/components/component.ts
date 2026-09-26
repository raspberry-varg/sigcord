import { component } from '../framework/hooks/index.js';

import type { ComponentDefinition } from '../lib/components/componentDefinition.js';
import type { MessageActionRowComponentBuilder } from 'discord.js';

/**
 * @deprecated Please use {@link import('src/index.js').useComponentHandler} instead.
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
