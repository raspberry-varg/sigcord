/**
 * Functional implementation of Menu Views.
 */

import type { Synapse } from './menu/synapse.js';
import { PropsBase, type ViewDefinitionBase } from './MenuView/ViewBase.js';
import { ClassViewDefinitionBody } from './views/classic/classViewDefinition.js';

export type ClassViewDefinition<Props extends PropsBase = PropsBase> =
  ViewDefinitionBase & ClassViewDefinitionBody<Props>;

export type ClassViewProps<Props extends PropsBase = PropsBase> = Props & {
  $: Synapse;
};
