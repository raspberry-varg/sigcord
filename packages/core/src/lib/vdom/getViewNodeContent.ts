import { type EmbedBuilder } from 'discord.js';

import { getOwner } from '../owners/owner.js';
import { flattenLegacy } from '../render/flatten.js';

import type { ViewComponent } from '../views/viewFlavors.js';
import type { ViewNodeLegacy } from './viewNodeLegacy.js';

export function getViewNodeContent<T extends EmbedBuilder | ViewComponent>(
  node: ViewNodeLegacy<T>,
): T[] {
  const currentOwner = getOwner();
  return flattenLegacy(node, currentOwner);
}
