import { getCurrentSynapse } from '../../../lib/builtins/builtins.js';
import { Synapse } from '../../../lib/menu/instance/synapse.js';
import { useCordInternal } from '../../cordContext.js';
import { createUniqueComponentId } from '../createUniqueComponentId.js';
import { useComponentHandler } from '../useComponentHandler.js';

/**
 * @deprecated Please use {@link useComponentHandler}.
 *
 * Configures an interactive message component.
 *
 * - Passed component id is auto-formatted to `menuId:viewId:componentId`.
 *   - `viewId:viewId:componentId` if standalone.
 * - Calls the passed component builder's `setCustomId` with the provided id.
 * - Binds a given handler to a component via its id.
 * @returns The provided component builder.
 */
export const component: Synapse['component'] = (definition) => {
  const cord = useCordInternal();
  if (cord) {
    // Handle partial migration.
    const id = definition.id || createUniqueComponentId();
    definition.component.setCustomId(id);
    useComponentHandler(id, (interaction) => {
      if (interaction.isMessageComponent()) {
        definition.handler(interaction as never);
      }
    });
    return definition.component;
  }
  return getCurrentSynapse().component(definition);
};
