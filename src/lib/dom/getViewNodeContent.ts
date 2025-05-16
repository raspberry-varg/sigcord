import { type EmbedBuilder } from 'discord.js';
import type { ViewComponent } from '../MenuView.js';
import { getOpenOwner } from '../render/owner.js';
import type { ViewNode } from './viewNode.js';
import { flatten } from '../render/flatten.js';

export function getViewNodeContent<T extends EmbedBuilder | ViewComponent>(
  node: ViewNode<T>,
): T[] {
  const currentOwner = getOpenOwner();
  return flatten(node, currentOwner);
}
