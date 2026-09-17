import { Strand } from './strand.js';
import type { Payload } from '../payload.js';
import { MessageFlags, type TopLevelComponent } from 'discord.js';
import { createRootOwner, runWithOwner } from '../../lib/owners/owner.js';
import { ViewElementNode } from '../../lib/dom/viewElementNode.js';
import type { ViewNodeKind } from '../../lib/dom/viewNodeKind.js';
import { renderFragment } from '../../lib/render/render.js';
import { flatten } from '../../lib/render/flatten.js';
import { provideContextValue } from '../../lib/contexts/provideContext.js';
import { CordContext } from '../cordContext.js';
import type { Cord } from '../cord.js';

export class ComponentsV2Strand extends Strand {
  private readonly rootOwner = createRootOwner();
  private rootElement?: ViewElementNode;

  constructor(
    cord: Cord,
    private readonly factory: () => ViewNodeKind,
  ) {
    super(cord);
  }

  override render(): Payload {
    if (!this.rootElement) {
      this.rootElement = new ViewElementNode();
      const children = runWithOwner(this.rootOwner, () => {
        provideContextValue(CordContext, this.cord);
        return renderFragment(this.factory);
      });
      this.rootElement.setChildren(...children);
    }
    return {
      flags: MessageFlags.IsComponentsV2,
      components: flatten<TopLevelComponent>(this.rootElement, this.rootOwner),
    };
  }

  override destroy() {
    this.rootOwner.dispose();
    this.rootElement?.dispose();
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
