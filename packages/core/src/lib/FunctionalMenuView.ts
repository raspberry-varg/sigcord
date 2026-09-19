/**
 * Functional implementation of Menu Views.
 */
import type { Synapse } from "./menu/instance/synapse.js";
import { ClassViewDefinitionBody } from "./views/classic/classViewDefinition.js";
import {
  PropsBase,
  type ViewDefinitionBase,
} from "./views/viewDefinitionBase.js";

export type ClassViewDefinition<Props extends PropsBase = PropsBase> =
  ViewDefinitionBase & ClassViewDefinitionBody<Props>;

export type ClassViewProps<Props extends PropsBase = PropsBase> = Props & {
  $: Synapse;
};
