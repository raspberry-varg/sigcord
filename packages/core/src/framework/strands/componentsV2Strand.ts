import { MessageFlags, type TopLevelComponent } from 'discord.js';

import { provideContextValue } from '../../lib/contexts/provideContext.js';
import { createRootOwner, runWithOwner } from '../../lib/owners/owner.js';
import { flatten } from '../../lib/render/flatten.js';
import { disposeNode } from '../../lib/vdom/index.js';
import { CordContext } from '../cordContext.js';
import { PatchTargetContext } from '../hooks/usePatchTarget.js';
import { PatchTarget } from '../patchTarget.js';

import { Strand } from './strand.js';

import type { Cord } from '../cord.js';
import type { Payload } from '../payload.js';

const isDev = process.env.NODE_ENV !== 'production';

type UncheckedFactory = () => unknown;

export class ComponentsV2Strand extends Strand {
  private readonly rootOwner = createRootOwner();
  private vdom?: unknown;

  constructor(
    cord: Cord,
    private readonly factory: UncheckedFactory,
  ) {
    super(cord);
  }

  override render(): Payload {
    if (!this.vdom) {
      this.vdom = runWithOwner(this.rootOwner, () => {
        provideContextValue(CordContext, this.cord);
        provideContextValue(PatchTargetContext, PatchTarget.Components);
        return this.factory();
      });
    }
    return {
      flags: MessageFlags.IsComponentsV2,
      components: runWithOwner(
        this.rootOwner,
        () => flatten(this.vdom, isDev ? 'Root' : undefined) as TopLevelComponent[],
      ),
    };
  }

  override destroy() {
    this.rootOwner.dispose();
    disposeNode(this.vdom);
    super.destroy();
  }

  override suspend() {
    this.rootOwner.suspend();
    super.suspend?.();
  }

  override resume() {
    this.rootOwner.resume();
    super.resume?.();
  }
}
