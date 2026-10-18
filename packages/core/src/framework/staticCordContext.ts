import { createInternalContext } from '../core/contexts/createInternalContext.js';
import { extractContext } from '../lib/contexts/useContext.js';
import { getOwner } from '../lib/owners/owner.js';

import type { StaticCord } from './staticCord.js';

export const StaticCordContext = createInternalContext<StaticCord>('StaticCord');

export function inStaticCord(): boolean {
  const owner = getOwner();
  return owner != null && !!extractContext(owner, StaticCordContext);
}
