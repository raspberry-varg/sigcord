import { PropsBase, type ViewDefinitionBase } from '../viewDefinitionBase.js';

import { ClassViewDefinitionBody } from './classViewDefinition.js';

/**
 * Functional implementation of Menu Views.
 */
import type { Synapse } from '../../menu/instance/synapse.js';

export type ClassViewDefinition<Props extends PropsBase = PropsBase> = ViewDefinitionBase &
  ClassViewDefinitionBody<Props>;

export type ClassViewProps<Props extends PropsBase = PropsBase> = Props & {
  $: Synapse;
};
