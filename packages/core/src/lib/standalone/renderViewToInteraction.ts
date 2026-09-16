import { type Instance, InstanceContext } from './instanceContext.js';
import { createRootOwner, runWithOwner } from '../owners/owner.js';
import type { DisposeFn } from '../render/dispose.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import { flattenToContentNodes } from '../render/flattenToContentNodes.js';
import type { ViewNodeKind } from '../dom/viewNodeKind.js';
import {
  type CollectedInteraction,
  MessageFlags,
  type RepliableInteraction,
} from 'discord.js';
import { MicrotaskQueuer } from '../menu/instance/microtaskQueuer.js';
import { InteractionPatcher } from '../menu/instance/interactionPatcher.js';
import { PatchTarget } from '../RenderingEngine.js';
import { flatten } from '../render/flatten.js';

interface RenderOptions {
  initialInteraction: RepliableInteraction;
  idleTimeMs?: number;
  flags?: MessageFlags;
}

export function renderViewToInteraction(
  options: RenderOptions,
  factory: () => ViewNodeKind,
): DisposeFn {
  const rootOwner = createRootOwner();
  const rootNode = new ViewElementNode();
  const patcher = new InteractionPatcher(options.initialInteraction, {
    flags: options.flags,
    idleTimeMs: options.idleTimeMs,
    renderAfterHandledInteraction: true,
  });
  const instance: Instance = {
    rootOwner,
    rootNode,
    registry: new Map(),
    interaction: options.initialInteraction,
    microtaskQueuer: new MicrotaskQueuer(() => updateMicrotask(instance)),
    patchMask: PatchTarget.All, // initial render
    nextUniqueId: 0,
    patcher,
  };
  rootOwner.context[InstanceContext.id] = instance;

  const nodes = runWithOwner(rootOwner, () => {
    return flattenToContentNodes(factory());
  });
  rootNode.addChild(...nodes);

  await updateMicrotask(instance);

  return () => {
    rootOwner.dispose();
  };
}

async function updateMicrotask(instance: Instance): Promise<void> {
  if (
    instance.rootOwner.disposed ||
    (instance.patchMask & PatchTarget.Components) === 0
  ) {
    return;
  }
  instance.patchMask = PatchTarget.None;
}

function enqueueUpdate(instance: Instance) {
  if (instance.rootOwner.disposed) {
    return;
  }
  instance.microtaskQueuer.set();
}

async function onCollect(
  instance: Instance,
  interaction: CollectedInteraction,
): Promise<void> {
  const handler = instance.registry.get(interaction.customId);
  if (handler) {
    const promise = runWithOwner(
      handler.owner,
      handler.handler.bind(null, interaction),
    );
    if (promise) await promise;
    instance.microtaskQueuer.set();
  }
}
