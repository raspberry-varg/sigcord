import { type EmbedBuilder, type TopLevelComponent } from 'discord.js';

import { ComponentsV1ImperativeAPIContext } from '../../core/contexts/componentsV1ImperativeAPIContext.js';
import { type Slot, slot } from '../../core/primitives/slot.js';
import { provideContextValue } from '../../lib/contexts/provideContext.js';
import {
  createRootOwner,
  getOwnerOrThrow,
  owner,
  type Owner,
  runWithOwner,
} from '../../lib/owners/owner.js';
import { flatten } from '../../lib/render/flatten.js';
import { CordContext } from '../cordContext.js';
import { PatchTargetContext } from '../hooks/usePatchTarget.js';
import { PatchTarget, type PatchTargetBitMask } from '../patchTarget.js';

import { Strand } from './strand.js';

import type { Context } from '../../lib/contexts/context.js';
import type { Cord } from '../cord.js';
import type { Payload } from '../payload.js';

const isDev = process.env.NODE_ENV !== 'production';

interface Branch {
  vdom: unknown[];
  owner: Owner;
}

export interface V1Payload {
  content?: string | (() => string);
  embeds?: unknown;
  components?: unknown;
}

export type ComponentsV1ViewFactory = () => V1Payload;
type UncheckedComponentsV1ViewFactory = () => unknown;

export class ComponentsV1Strand extends Strand {
  private readonly rootOwner = createRootOwner();
  private fromFactory?: V1Payload;
  private content?: Branch;
  private embeds?: Branch;
  private components?: Branch;

  private queuedEmbeds?: Slot;
  private queuedComponents?: Slot;

  constructor(
    cord: Cord,
    private readonly factory: UncheckedComponentsV1ViewFactory,
    private readonly extraProvides: Map<Context<unknown>, unknown> | undefined,
  ) {
    super(cord);
  }

  override render(): Payload {
    const firstTime = !this.fromFactory;
    if (!this.fromFactory) {
      const unchecked = runWithOwner(this.rootOwner, () => {
        provideContextValue(CordContext, this.cord);
        provideContextValue(PatchTargetContext, PatchTarget.All);
        provideContextValue(ComponentsV1ImperativeAPIContext, {
          queueEmbeds: (...embeds: unknown[]) => {
            this.queuedEmbeds!.push(...embeds);
          },
          prependEmbeds: (...embeds: unknown[]) => {
            this.queuedEmbeds!.unshift(...embeds);
          },
          queueComponents: (...components: unknown[]) => {
            this.queuedComponents!.push(...components);
          },
          prependComponents: (...components: unknown[]) => {
            this.queuedComponents!.unshift(...components);
          },
        });
        if (this.extraProvides) {
          for (const [context, value] of this.extraProvides) {
            provideContextValue(context, value);
          }
        }
        this.queuedEmbeds = slot({ ephemeral: true });
        this.queuedComponents = slot({ ephemeral: true });
        return this.factory();
      });
      // TODO: Strict flag to toggle these tests?
      if (!unchecked || typeof unchecked !== 'object') {
        throw new Error('ComponentsV1Strand factory must return an object');
      }
      if (!('content' in unchecked || 'embeds' in unchecked || 'components' in unchecked)) {
        throw new Error(
          'ComponentsV1Strand factory must return an object with at least content, embeds or components.',
        );
      }
      this.fromFactory = unchecked as V1Payload;
    }

    const shape = this.fromFactory;
    const payload: {
      content?: string;
      embeds?: EmbedBuilder[];
      components?: TopLevelComponent[];
    } = {};
    if (!this.content && shape.content) {
      this.content = runWithOwner(this.rootOwner, () =>
        owner(() => {
          provideContextValue(PatchTargetContext, PatchTarget.Content);
          return {
            owner: getOwnerOrThrow(),
            vdom: [typeof shape.content === 'function' ? shape.content() : shape.content],
          };
        }),
      );
    }

    if (!this.embeds && shape.embeds) {
      this.embeds = runWithOwner(this.rootOwner, () =>
        owner(() => {
          provideContextValue(PatchTargetContext, PatchTarget.Embeds);
          return {
            owner: getOwnerOrThrow(),
            vdom: [typeof shape.embeds === 'function' ? shape.embeds() : shape.embeds],
          };
        }),
      );
    }

    if (!this.components && shape.components) {
      this.components = runWithOwner(this.rootOwner, () =>
        owner(() => {
          provideContextValue(PatchTargetContext, PatchTarget.Components);
          return {
            owner: getOwnerOrThrow(),
            vdom: [typeof shape.components === 'function' ? shape.components() : shape.components],
          };
        }),
      );
    }

    const dirty: PatchTargetBitMask = firstTime ? PatchTarget.All : this.cord.dirty;
    if (this.content && (dirty & PatchTarget.Content) !== 0) {
      const content = this.content;
      const flattened = runWithOwner(content.owner, () =>
        flatten(content.vdom, isDev ? 'Root > Content' : undefined),
      );
      payload.content = Array.isArray(flattened) ? flattened.join(' ') : String(flattened);
    }
    if (this.embeds && (dirty & PatchTarget.Embeds) !== 0) {
      const embeds = this.embeds;
      payload.embeds = runWithOwner(embeds.owner, () =>
        flatten([embeds.vdom, this.queuedEmbeds], isDev ? 'Root > Embeds' : undefined),
      ) as EmbedBuilder[];
    }
    if (this.components && (dirty & PatchTarget.Components) !== 0) {
      const components = this.components;
      payload.components = runWithOwner(components.owner, () =>
        flatten([components.vdom, this.queuedComponents], isDev ? 'Root > Components' : undefined),
      ) as TopLevelComponent[];
    }

    return payload;
  }

  override destroy() {
    this.rootOwner.dispose();
    this.fromFactory = undefined;
    this.content = undefined;
    this.embeds = undefined;
    this.components = undefined;
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
