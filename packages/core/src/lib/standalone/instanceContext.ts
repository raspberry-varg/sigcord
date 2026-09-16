import type { Context } from '../contexts/context.js';
import type { Owner } from '../owners/owner.js';
import type { ViewElementNode } from '../dom/viewElementNode.js';
import type { CollectedInteraction, RepliableInteraction } from 'discord.js';
import type { PatchTargetBitMask } from '../RenderingEngine.js';
import type { MicrotaskQueuer } from '../menu/instance/microtaskQueuer.js';
import type { InteractionPatcher } from '../menu/instance/interactionPatcher.js';

export interface Instance {
  readonly rootOwner: Owner;
  readonly rootNode: ViewElementNode;
  readonly registry: Map<
    string,
    Readonly<{
      owner: Owner;
      handler: (interaction: CollectedInteraction) => void | Promise<void>;
    }>
  >;
  interaction: RepliableInteraction;
  patchMask: PatchTargetBitMask;
  nextUniqueId: number;
  microtaskQueuer: MicrotaskQueuer;
  patcher: InteractionPatcher;
}

export const InstanceContext: Context<Instance | undefined> = {
  id: Symbol.for('__sigcord_RootInstanceContext'),
  default: undefined,
};
