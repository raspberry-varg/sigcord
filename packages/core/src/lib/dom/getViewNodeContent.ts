import {type EmbedBuilder} from 'discord.js';

import {getOwner} from '../owners/owner.js';
import {flatten} from '../render/flatten.js';
import type {ViewComponent} from '../views/viewFlavors.js';
import type {ViewNode} from './viewNode.js';

export function getViewNodeContent<T extends EmbedBuilder | ViewComponent>(
  node: ViewNode<T>,
): T[] {
  const currentOwner = getOwner();
  return flatten(node, currentOwner);
}
