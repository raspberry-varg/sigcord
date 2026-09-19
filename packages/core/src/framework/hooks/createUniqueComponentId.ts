import { getCurrentSynapse } from "../../lib/builtins/builtins.js";
import { useCordInternal } from "../cordContext.js";

/**
 * Creates a component ID unique within the current Cord instance. Not meant to
 * be unique across multiple Cord instances, nor is it cryptographically secure.
 */
export function createUniqueComponentId(): `__component_${number}` {
  const cord = useCordInternal();
  if (!cord) {
    // Legacy behavior
    return getCurrentSynapse().getNextUniqueComponentId() as `__component_${number}`;
  }
  return cord.createUniqueComponentId();
}
