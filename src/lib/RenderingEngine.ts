import type { EmbedBuilder } from 'discord.js';
import type { Props } from '..';
import { assert } from '../util/Assertions';
import {
  instantiateViewFromClosure,
  type View,
  type ViewInstance,
} from './FunctionalMenuView';
import type { ViewPayload } from './MenuView';

interface QueuedView {
  view: View;
  args: unknown[];
}

interface QueuedEmbeds {
  prepend: EmbedBuilder[];
  append: EmbedBuilder[];
}

export class RenderingEngine {
  view?: View;
  private queuedView?: QueuedView;
  private closureViewCache = new Map<string, ViewInstance>();
  // @ts-ignore
  private wantRender = true;
  private queuedEmbeds?: Partial<QueuedEmbeds>;

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
  }

  queueViewSwap(view: View, args: unknown[]) {
    this.queuedView = { view, args };
  }

  async render(props: Props): Promise<ViewPayload> {
    if (this.queuedView) {
      this.view = this.queuedView.view;
    }
    const view = await this.getViewInstance(props);
    if (this.queuedView) {
      await view.onSwap?.(...this.queuedView.args);
      this.queuedView = undefined;
    }
    const payload = await view.render(props);
    if (this.queuedEmbeds) {
      payload.embeds = this.attachEnqueuedEmbeds(payload.embeds ?? []);
    }
    this.postRender();
    return payload;
  }

  private postRender() {
    this.wantRender = true;
    this.queuedEmbeds = undefined;
  }

  private async getViewInstance(props: Props): Promise<ViewInstance> {
    assert(this.view, 'Internal error, View was not set.');
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
}
