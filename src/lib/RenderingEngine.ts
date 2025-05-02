import { EmbedBuilder, MessageFlags } from 'discord.js';
import { assert } from '../util/Assertions.js';
import { isClassViewInstance } from './views/classic/classViewInstance.js';
import { isReactiveViewInstance } from './views/reactive/reactiveViewInstance.js';
import { type View, type ViewInstance } from './views/view.js';
import type {
  EmbedComponent,
  RenderedReactiveView,
  ViewComponent,
  ViewMessagePayload,
} from './MenuView.js';
import { isRenderedReactiveViewV2 } from './MenuView.js';
import { logger } from '../util/Logger.js';
import { createUntracked, read } from './Reactivity.js';
import { type PropsBase } from './MenuView/ViewBase.js';
import type { NavigationPayload } from './Navigation.js';
import {
  instantiateReactiveView,
  type ReactiveViewInstance,
} from './MenuView/ReactiveView.js';
import { isReactiveViewDefinition } from './views/reactive/reactiveViewDefinition.js';
import { setReactiveContext } from './ReactiveBuiltIns.js';
import { instantiateClassView } from './views/classic/classViewInstance.js';
import { batch } from '@preact/signals-core';
import type { Props } from '../index.js';
import { render } from './render/render.js';
import { ViewElementNode } from './dom/viewElementNode.js';
import { owner } from './render/owner.js';
import { flatten } from './render/flatten.js';

export type PatchTargetBitMask = number;

/**
 * The portion of a {@link ViewMessagePayload message payload} to update.
 */
export enum PatchTarget {
  None = 0,
  Embeds = 1,
  Components = 2,
  Content = 4,
  All = Embeds | Components | Content,
}

type QueuedView = {
  view: View;
  skipCache: boolean;
} & (
  | {
      args: unknown[];
    }
  | {
      props: PropsBase;
    }
);

interface QueuedMessagePart<T> {
  prepend: T[];
  append: T[];
}

type QueuedEmbeds = QueuedMessagePart<EmbedBuilder>;
type QueuedComponents = QueuedMessagePart<ViewComponent>;

export class RenderingEngine {
  viewDefinition?: View;
  private queuedView?: QueuedView;
  private instances = new Map<string, ViewInstance>();
  private wantRender = true;
  private queuedEmbeds?: Partial<QueuedEmbeds>;
  private queuedComponents?: Partial<QueuedComponents>;
  private queuedClears: PatchTargetBitMask = 0;
  private reactiveViewInstance?: ReactiveViewInstance;
  private patchContext = PatchTarget.None;
  private queuedNavigation?: NavigationPayload;

  isCurrentViewReactive(): boolean {
    return (
      !!this.viewDefinition && isReactiveViewDefinition(this.viewDefinition)
    );
  }

  isCurrentViewV2(): boolean {
    return (
      !!this.reactiveViewInstance &&
      isRenderedReactiveViewV2(this.reactiveViewInstance!)
    );
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

  hasQueuedComponents(): boolean {
    return !!this.queuedComponents;
  }

  clearCachedView(id: string): void {
    this.instances.delete(id);
  }

  getPatchContext(): PatchTarget {
    return this.patchContext;
  }

  getCurrentView(): View | undefined {
    return this.viewDefinition;
  }

  getQueuedView(): Readonly<QueuedView> | undefined {
    return this.queuedView;
  }

  getQueuedNavigation(): Readonly<NavigationPayload> | undefined {
    return this.queuedNavigation;
  }

  getReactivePayload(): RenderedReactiveView | undefined {
    return this.reactiveViewInstance;
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

  prependComponents(...components: ViewComponent[]): void {
    this.queuedComponents ??= {};
    this.queuedComponents.prepend ??= [];
    this.queuedComponents.prepend.push(...components);
  }

  appendComponents(...components: ViewComponent[]): void {
    this.queuedComponents ??= {};
    this.queuedComponents.append ??= [];
    this.queuedComponents.append.push(...components);
  }

  queueRender(wantRender = true) {
    this.wantRender = wantRender;
    this.wantRender;
  }

  queueClear(patchTargets: PatchTargetBitMask): void {
    this.queuedClears |= patchTargets;
  }

  queueViewSwapWithProps(
    view: View,
    props: PropsBase,
    skipCache = false,
  ): void {
    this.queuedView = { view, props, skipCache };
  }

  queueViewSwap(view: View, args: unknown[]): void {
    if (view === this.queuedView?.view) {
      logger.warn(
        `Tried to queue the currently-active view with id=${view.id}: `,
        view,
      );
      return;
    }
    this.queuedView = { view, args, skipCache: false };
  }

  queueNavigation(navigationPayload: NavigationPayload): void {
    this.queuedNavigation = navigationPayload;
  }

  dispose(): void {
    logger.debug('Disposing RenderingEngine');
    for (const instance of this.instances.values()) {
      const isReactive = isReactiveViewInstance(instance);
      const isV2 = isReactive && isRenderedReactiveViewV2(instance);
      logger.debug(`Maybe disposing instance.id=${instance.id}`, {
        isReactive,
        isV2,
      });
      if (isReactive) {
        logger.debug('Calling disposal function', {
          dispose: instance.dispose,
        });
        instance.dispose?.();
      } else {
        logger.debug('Not disposing: Not reactive.');
      }
    }
  }

  async patch(
    props: Props,
    targets: PatchTargetBitMask,
  ): Promise<ViewMessagePayload> {
    assert(this.viewDefinition, 'Internal error: View was not set.');
    logger.debug('Patch requested', {
      targets,
      reactiveViewInstance: this.reactiveViewInstance,
    });
    const queuedNav = this.queuedNavigation;
    if (
      this.queuedView ||
      (queuedNav && !queuedNav.reactiveInstance) ||
      !this.isCurrentViewReactive()
    ) {
      // do a full render instead
      return await this.render(props);
    }

    if (queuedNav && queuedNav.reactiveInstance) {
      this.applyQueuedNavigation();
      targets |= PatchTarget.All;
    }

    // reactive patching
    assert(
      this.reactiveViewInstance,
      'Internal error: Reactive payload was not set.',
    );
    return this.patchReactive(this.reactiveViewInstance, props, targets);
  }

  patchReactive(
    instance: ReactiveViewInstance,
    props: Props,
    targets: PatchTargetBitMask,
  ) {
    const $ = props.$;
    targets |= this.queuedClears;
    const payload: ViewMessagePayload = {};
    logger.debug('Patching reactive view', { targets, viewInstance: instance });
    try {
      setReactiveContext($);
      batch(() => {
        const isV2 = isRenderedReactiveViewV2(instance);
        logger.debug(`Patching with V${isV2 ? 2 : 1} components.`);
        if (!targets) {
          if (isV2) {
            if (!this.hasQueuedComponents()) {
              return;
            }
          } else {
            // V1
            if (!this.hasQueuedEmbeds()) {
              return;
            }
          }
        }

        if (isRenderedReactiveViewV2(instance)) {
          payload.flags = (payload.flags ?? 0) | MessageFlags.IsComponentsV2;
          const patchTarget = (this.patchContext = PatchTarget.Components);
          if (this.isQueuedForClear(patchTarget)) {
            payload.components = [];
          } else {
            if (!instance.root) {
              const [root, dispose, owner] = render<ViewComponent>(
                () => instance.factory(),
                patchTarget,
              );
              owner.debugName = 'V2_root';
              instance.root = root;
              instance.dispose = dispose;
            }

            const flattened = flatten(instance.root, instance.owner);
            instance.lastRender = payload.components = flattened;

            if (this.queuedComponents) {
              payload.components = this.resolveWithQueuedItems(
                payload.components,
                this.queuedComponents,
              );
            }
          }

          return;
        }

        if (!instance.roots) {
          const superOwner = owner(() => {
            instance.roots = {};
            const roots: ViewElementNode<EmbedComponent | ViewComponent>[] = [];
            const result = (instance.lastRender = instance.factory());
            // TODO: @raspberry-varg - Content handling.
            if (result.embeds) {
              const [embedsRoot, , owner] = render<EmbedComponent>(
                result.embeds,
                PatchTarget.Embeds,
              );
              owner.debugName = 'V1_embeds_root';
              instance.roots.embeds = embedsRoot;
              roots.push(embedsRoot);
            }
            if (result.components) {
              const [componentsRoot, , owner] = render<ViewComponent>(
                result.components,
                PatchTarget.Components,
              );
              owner.debugName = 'V1_components_root';
              instance.roots.components = componentsRoot;
              roots.push(componentsRoot);
            }

            return roots;
          });
          superOwner.debugName = 'V1_super_root';

          instance.dispose = () => superOwner.dispose();
          instance.owner = superOwner;

          const wantEphemeral = instance.lastRender!.ephemeral;
          if (wantEphemeral !== undefined) {
            payload.ephemeral = wantEphemeral;
          }

          assert(instance.roots);
        }

        assert(instance.lastRender);

        const { roots } = instance;
        if (roots.embeds) {
          if (this.isQueuedForClear(PatchTarget.Embeds)) {
            payload.embeds = [];
          } else {
            const embedsRoot = roots.embeds;
            payload.embeds = flatten(embedsRoot, instance.owner);
            logger.debug('flattened embeds', payload.embeds);
          }
        }
        if (roots.components) {
          if (this.isQueuedForClear(PatchTarget.Components)) {
            payload.components = [];
          } else {
            const componentsRoot = roots.components;
            payload.components = flatten(componentsRoot, instance.owner);
            logger.debug('flattened components', payload.components);
          }
        }

        // TODO: @raspberry-varg - Content should be a tree as well.
        if (this.isQueuedForClear(PatchTarget.Content)) {
          payload.content = '';
        } else if (instance.lastRender.content) {
          payload.content = createUntracked(() => {
            if (instance.lastRender?.content == null) {
              return undefined;
            }
            return read(instance.lastRender.content);
          });
        }

        if (this.queuedEmbeds) {
          payload.embeds = this.resolveWithQueuedItems(
            payload.embeds,
            this.queuedEmbeds,
          );
        }

        if (this.queuedComponents) {
          payload.components = this.resolveWithQueuedItems(
            payload.components,
            this.queuedComponents,
          );
        }
      });
    } finally {
      this.postRender();
      setReactiveContext(null);
    }
    return payload;
  }

  async render(props: Props): Promise<ViewMessagePayload> {
    if (this.queuedView) {
      this.viewDefinition = this.queuedView.view;
    }

    if (this.queuedNavigation) {
      this.applyQueuedNavigation();
      if (this.reactiveViewInstance) {
        return this.patchReactive(
          this.reactiveViewInstance,
          props,
          PatchTarget.All,
        );
      }
    }

    const view = this.getViewInstance(
      !this.queuedView || 'args' in this.queuedView
        ? props
        : { $: props.$, ...this.queuedView.props },
    );
    if (this.queuedView) {
      if ('args' in this.queuedView && isClassViewInstance(view)) {
        await view.instance.onSwap(...this.queuedView.args);
      }
      this.queuedView = undefined;
      this.reactiveViewInstance = undefined;
    }
    if (isReactiveViewInstance(view)) {
      this.reactiveViewInstance = view;
      return this.patchReactive(view, props, PatchTarget.All);
    }
    const payload = await batch(() => view.instance.render(props));
    if (this.queuedEmbeds) {
      payload.embeds = this.resolveWithQueuedItems(
        payload.embeds,
        this.queuedEmbeds,
      );
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

  private getViewInstance(props: Props): ViewInstance {
    const viewDefinition = this.viewDefinition;
    assert(viewDefinition, 'Internal error: View was not set.');

    if (isReactiveViewDefinition(viewDefinition)) {
      let reactiveInstance = this.reactiveViewInstance;
      if (!reactiveInstance || viewDefinition.id !== reactiveInstance.id) {
        // rendering must be synchronous; built-ins rely on the single-threaded
        // nature of JS
        try {
          setReactiveContext(props.$);
          reactiveInstance = instantiateReactiveView(viewDefinition, props);
          this.reactiveViewInstance = reactiveInstance;
          this.instances.set(reactiveInstance.id, reactiveInstance);
        } catch (e) {
          logger.debug(
            'Encountered an error while rendering a reactive view:',
            e,
          );
          throw e;
        } finally {
          setReactiveContext(null);
        }
      }
      return reactiveInstance;
    }

    // class based view
    let viewClassInstance = this.instances.get(viewDefinition.id);
    if (!viewClassInstance) {
      viewClassInstance = instantiateClassView(viewDefinition, props);
      this.instances.set(viewClassInstance.id, viewClassInstance);
    }
    return viewClassInstance;
  }

  private applyQueuedNavigation(): void {
    assert(
      this.queuedNavigation,
      'Internal error: Tried to apply queuedNavigation before being assigned a value.',
    );
    this.viewDefinition = this.queuedNavigation.view;

    const instance = this.queuedNavigation.reactiveInstance;
    const id = this.queuedNavigation.view.id;
    this.queuedNavigation = undefined;

    if (!instance) {
      this.reactiveViewInstance = undefined;
      return;
    }

    if (isRenderedReactiveViewV2(instance)) {
      const clone = Object.assign({}, instance, {
        id,
      });
      this.reactiveViewInstance = clone;
    } else {
      // legacy
      const clone = {
        ...instance,
        id,
      };
      this.reactiveViewInstance = clone;
    }
  }

  private resolveWithQueuedItems<T>(
    dest: T[] = [],
    queue: Partial<QueuedMessagePart<T>> | undefined,
  ): T[] {
    if (!queue) {
      return dest;
    }

    const enqueued = [...(queue.prepend ?? []), ...(queue.append ?? [])].slice(
      0,
      10,
    );
    if (!enqueued.length) return dest;

    let final = [...dest, ...enqueued];
    if (final.length > 10) {
      final = final.slice(-10, final.length);
    }

    return final;
  }

  private isQueuedForClear(target: PatchTargetBitMask): boolean {
    return !!(target & this.queuedClears);
  }
}
