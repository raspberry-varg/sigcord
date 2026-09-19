import { Synapse } from '../menu/instance/synapse.js';
import { getOwner } from '../owners/owner.js';

export const SYNAPSE_CONTEXT_ID = Symbol.for('__sigcord.Synapse');

export function getCurrentSynapse(): Synapse {
  const synapse = getCurrentSynapseOrDefault();
  if (!synapse) {
    throw new Error(
      'Attempted to use a hook outside of a reactive context. Was this called ' +
        'outside of a reactive view?\n\nClassic menu views should use the ' +
        'Synapse parameter directly ($).\n\n' +
        'Did you await within the body of a component function?',
    );
  }
  return synapse;
}

export function getCurrentSynapseOrDefault(): Synapse | undefined {
  const owner = getOwner();
  return owner?.context[SYNAPSE_CONTEXT_ID] as Synapse | undefined;
}
