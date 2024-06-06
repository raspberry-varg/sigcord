import type { EmbedBuilder } from 'discord.js';
import { Signal, type Props } from '../index.js';
import { assert } from '../util/Assertions.js';
import {
  instantiateViewFromClosure,
  isReactiveViewInstance,
  type View,
  type ViewInstance,
} from './FunctionalMenuView.js';
import type { RenderedReactiveViewPayload, ViewPayload } from './MenuView.js';
import { PatchTarget, type PatchTargetBitField } from './MenuController.js';
import { logger } from '../util/Logger.js';

interface QueuedView {
  view: View;
  args: unknown[];
}

interface QueuedEmbeds {
  prepend: EmbedBuilder[];
  append: EmbedBuilder[];
}
function resolveMaybeSignal<T>(maybeSignal: T | Signal<T>): T;
function resolveMaybeSignal<T>(
  maybeSignal: T | Signal<T> | undefined
): T | undefined;
function resolveMaybeSignal<T>(
  maybeSignal: T | Signal<T> | undefined
): T | undefined {
  return maybeSignal instanceof Signal ? maybeSignal.get() : maybeSignal;
}

export class RenderingEngine {
  view?: View;
  private queuedView?: QueuedView;
  private closureViewCache = new Map<string, ViewInstance>();
  private wantRender = true;
  private queuedEmbeds?: Partial<QueuedEmbeds>;
  private queuedClears: PatchTargetBitField = 0;
  private reactivePayload?: RenderedReactiveViewPayload;

  isCurrentViewReactive(): boolean {
    return !!this.view && isReactiveViewInstance(this.view);
  }

  hasQueuedView(): boolean {
    return !!this.queuedView;
  }

  prependEmbeds(...embeds: EmbedBuilder[]): void {
    this.queuedEmbeds ??= {};
    this.queuedEmbeds.prepend ??= [];
    this.queuedEmbeds.prepend.push(...embeds);
  }

  appendEmbeds(...embeds: EmbedBuilder[]): void {
    this.queuedEmbeds ??= {};
    this.queuedEmbeds.append ??= [];
    this.queuedEmbeds.append.push(...embeds);
  }

  queueRender(wantRender = true) {
    this.wantRender = wantRender;
    this.wantRender;
  }

  queueClear(patchTargets: PatchTargetBitField): void {
    this.queuedClears |= patchTargets;
  }

  queueViewSwap(view: View, args: unknown[]) {
    if (view === this.queuedView?.view) {
      logger.warn(
        `Tried to queue the currently-active view with id=${view.id}: `,
        view
      );
      return;
    }
    this.queuedView = { view, args };
  }

  async patch(
    props: Props,
    targets: PatchTargetBitField
  ): Promise<ViewPayload> {
    assert(this.view, 'Internal error: View was not set.');
    if (this.queuedView || !isReactiveViewInstance(this.view)) {
      // do a full render instead
      return await this.render(props);
    }

    // reactive patching
    assert(
      this.reactivePayload,
      'Internal error: Reactive payload was not set.'
    );
    targets |= this.queuedClears;
    const payload: ViewPayload = {};
    if (this.reactivePayload.ephemeral !== undefined) {
      payload.ephemeral = this.reactivePayload.ephemeral;
    }
    if (targets & PatchTarget.Content) {
      if (this.isQueuedForClear(PatchTarget.Content)) {
        payload.content = '';
      } else if (this.reactivePayload.content !== undefined) {
        payload.content = resolveMaybeSignal(this.reactivePayload.content);
      }
    }
    if (targets & PatchTarget.Embeds || this.queuedEmbeds) {
      payload.embeds = resolveMaybeSignal(this.reactivePayload.embeds);
      if (this.isQueuedForClear(PatchTarget.Embeds)) {
        payload.embeds = [];
      }
      if (this.queuedEmbeds) {
        payload.embeds = this.attachEnqueuedEmbeds(payload.embeds ?? []);
      }
    }
    if (targets & PatchTarget.Components) {
      if (this.isQueuedForClear(PatchTarget.Components)) {
        payload.components = [];
      } else if (this.reactivePayload.components !== undefined) {
        payload.components = resolveMaybeSignal(
          this.reactivePayload.components
        );
      }
    }
    this.postRender();
    return payload;
  }

  async render(props: Props): Promise<ViewPayload> {
    if (this.queuedView) {
      this.view = this.queuedView.view;
    }
    const view = await this.getViewInstance(props);
    if (this.queuedView) {
      await view.onSwap?.(...this.queuedView.args);
      this.queuedView = undefined;
      this.reactivePayload = undefined;
    }
    let payload: ViewPayload;
    if (isReactiveViewInstance(view)) {
      payload = {
        ephemeral: view.ephemeral,
        content:
          typeof view.content === 'string' ? view.content : view.content?.(),
        embeds: maybeCallArray(view.embeds),
        components: maybeCallArray(view.components),
      };
      this.reactivePayload = {
        ...payload,
        embeds: [...(payload.embeds ? payload.embeds : [])],
      };
    } else {
      payload = await view.render(props);
    }
    if (this.queuedEmbeds) {
      payload.embeds = this.attachEnqueuedEmbeds(payload.embeds ?? []);
    }
    this.postRender();
    return payload;
  }

  private postRender() {
    this.wantRender = true;
    this.queuedEmbeds = undefined;
    this.queuedClears = 0;
  }

  private async getViewInstance(props: Props): Promise<ViewInstance> {
    assert(this.view, 'Internal error: View was not set.');
    let viewInstance: ViewInstance;
    if (!('closure' in this.view)) {
      viewInstance = this.view;
    } else {
      // try cache for instantiated view
      const id = this.view.id;
      if (!this.closureViewCache.has(id)) {
        this.closureViewCache.set(
          id,
          // eslint-disable-next-line @typescript-eslint/ban-types
          await instantiateViewFromClosure<{}>(this.view, props)
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      viewInstance = this.closureViewCache.get(id)!;
    }
    return viewInstance;
  }

  private attachEnqueuedEmbeds(embeds: EmbedBuilder[]): EmbedBuilder[] {
    if (!this.queuedEmbeds) {
      return embeds;
    }
    const enqueued = [
      ...(this.queuedEmbeds.prepend ?? []),
      ...(this.queuedEmbeds.append ?? []),
    ].slice(0, 10);
    embeds = [...embeds, ...enqueued];
    if (embeds.length > 10) {
      embeds = embeds.slice(-10, embeds.length);
    }
    return embeds;
  }

  private isQueuedForClear(target: PatchTargetBitField): boolean {
    return !!(target & this.queuedClears);
  }
}

function maybeCallArray<T>(fnOrArray?: T[] | (() => T[])): T[] | undefined {
  if (fnOrArray === undefined) {
    return fnOrArray;
  }
  return Array.isArray(fnOrArray) ? fnOrArray : fnOrArray();
}
