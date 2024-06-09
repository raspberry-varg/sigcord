import type { EmbedBuilder } from 'discord.js';
import { flattenChildren, isSignal, type Props } from '../index.js';
import { assert } from '../util/Assertions.js';
import {
  instantiateViewFromClosure,
  isReactiveViewInstance,
  type View,
  type ViewInstance,
} from './FunctionalMenuView.js';
import type { RenderedReactiveViewPayload, ViewPayload } from './MenuView.js';
import { logger } from '../util/Logger.js';
import type { MaybeSignal } from './Reactivity.js';
import { Reactive } from '@reactively/core';
import type { PropsBase } from './MenuView/ViewBase.js';
import type { NavigationPayload } from './Navigation.js';

export type PatchTargetBitField = number;

export enum PatchTarget {
  None = 0,
  Embeds = 1,
  Components = 2,
  Content = 4,
  All = Embeds | Components | Content,
}

type QueuedView = {
  view: View;
} & (
  | {
      args: unknown[];
    }
  | {
      props: PropsBase;
    }
);

interface QueuedEmbeds {
  prepend: EmbedBuilder[];
  append: EmbedBuilder[];
}
function resolveMaybeSignal<T>(maybeSignal: MaybeSignal<T>): T;
function resolveMaybeSignal<T>(
  maybeSignal: MaybeSignal<T> | undefined
): T | undefined;
function resolveMaybeSignal<T>(
  maybeSignal: MaybeSignal<T> | undefined
): T | undefined {
  return isSignal(maybeSignal) ? maybeSignal.get() : maybeSignal;
}

export class RenderingEngine {
  view?: View;
  private queuedView?: QueuedView;
  private closureViewCache = new Map<string, ViewInstance>();
  private wantRender = true;
  private queuedEmbeds?: Partial<QueuedEmbeds>;
  private queuedClears: PatchTargetBitField = 0;
  private reactivePayload?: RenderedReactiveViewPayload;
  private patchContext = PatchTarget.None;
  private queuedNavigation?: NavigationPayload;

  isCurrentViewReactive(): boolean {
    return !!this.view && !!this.reactivePayload;
  }

  hasQueuedNavigation(): boolean {
    return !!this.queuedNavigation;
  }

  hasQueuedView(): boolean {
    return !!this.queuedView;
  }

  hasQueuedEmbeds(): boolean {
    return !!this.queuedEmbeds;
  }

  getPatchContext(): PatchTarget {
    return this.patchContext;
  }

  getCurrentView(): View | undefined {
    return this.view;
  }

  getReactivePayload(): RenderedReactiveViewPayload | undefined {
    return this.reactivePayload;
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

  queueViewSwapWithProps(view: View, props: PropsBase): void {
    this.queuedView = { view, props };
  }

  queueViewSwap(view: View, args: unknown[]): void {
    if (view === this.queuedView?.view) {
      logger.warn(
        `Tried to queue the currently-active view with id=${view.id}: `,
        view
      );
      return;
    }
    this.queuedView = { view, args };
  }

  queueNavigation(navigationPayload: NavigationPayload): void {
    this.queuedNavigation = navigationPayload;
  }

  async patch(
    props: Props,
    targets: PatchTargetBitField
  ): Promise<ViewPayload> {
    assert(this.view, 'Internal error: View was not set.');
    const queuedNav = this.queuedNavigation;
    if (
      this.queuedView ||
      (queuedNav && !queuedNav.reactive) ||
      !this.isCurrentViewReactive()
    ) {
      // do a full render instead
      return await this.render(props);
    }

    if (queuedNav && queuedNav.reactive) {
      this.applyQueuedNavigation();
      targets |= PatchTarget.All;
    }

    // reactive patching
    assert(
      this.reactivePayload,
      'Internal error: Reactive payload was not set.'
    );
    const $ = props.$;
    targets |= this.queuedClears;
    const payload: ViewPayload = {};
    if (this.reactivePayload.ephemeral !== undefined) {
      payload.ephemeral = this.reactivePayload.ephemeral;
    }
    if (targets & PatchTarget.Content) {
      this.patchContext = PatchTarget.Content;
      const content = this.reactivePayload.content;
      if (this.isQueuedForClear(PatchTarget.Content)) {
        payload.content = '';
      } else if (content !== undefined) {
        if (typeof content === 'string' || content instanceof Reactive) {
          payload.content = resolveMaybeSignal(content);
        } else {
          this.reactivePayload.content = $.createSignal(content);
          payload.content = this.reactivePayload.content.get();
        }
      }
    }
    if (targets & PatchTarget.Embeds || this.hasQueuedEmbeds()) {
      this.patchContext = PatchTarget.Embeds;
      if (this.isQueuedForClear(PatchTarget.Embeds)) {
        payload.embeds = [];
      } else {
        payload.embeds = flattenChildren(
          $,
          this.reactivePayload.embeds,
          this.patchContext
        );
      }
      if (this.queuedEmbeds) {
        payload.embeds = this.attachEnqueuedEmbeds(payload.embeds ?? []);
      }
    }
    if (targets & PatchTarget.Components) {
      this.patchContext = PatchTarget.Components;
      if (this.isQueuedForClear(PatchTarget.Components)) {
        payload.components = [];
      } else if (this.reactivePayload.components !== undefined) {
        payload.components = flattenChildren(
          $,
          this.reactivePayload.components,
          this.patchContext
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
    if (this.queuedNavigation) {
      this.applyQueuedNavigation();
      if (this.reactivePayload) {
        return await this.patch(props, PatchTarget.All);
      }
    }
    const view = await this.getViewInstance(
      !this.queuedView || 'args' in this.queuedView
        ? props
        : { $: props.$, ...this.queuedView.props }
    );
    if (this.queuedView) {
      if ('args' in this.queuedView) {
        await view.onSwap?.(...this.queuedView.args);
      }
      this.queuedView = undefined;
      this.reactivePayload = undefined;
    }
    if (isReactiveViewInstance(view)) {
      this.reactivePayload = view;
      return await this.patch(props, PatchTarget.All);
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
    this.queuedNavigation = undefined;
    this.queuedClears = 0;
    this.patchContext = PatchTarget.None;
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

  private applyQueuedNavigation(): void {
    assert(
      this.queuedNavigation,
      'Internal error: Tried to apply queuedNavigation before being assigned a value.'
    );
    this.view = this.queuedNavigation.view;
    this.reactivePayload = this.queuedNavigation.reactive;
    this.queuedNavigation = undefined;
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
