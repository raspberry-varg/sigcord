import { MessageFlags, type EmbedBuilder } from 'discord.js';
import { assert } from '../util/Assertions.js';
import { isClassViewInstance } from './views/classic/classViewInstance.js';
import { isReactiveViewInstance } from './views/reactive/reactiveViewInstance.js';
import {
  type View,
  type ViewInstance
} from './views/view.js';
import type {
  RenderedReactiveView,
  ViewComponent,
  ViewMessagePayload,
} from './MenuView.js';
import { DEPRECATED_flattenChildren, isRenderedReactiveViewV2 } from './MenuView.js';
import { logger } from '../util/Logger.js';
import { read } from './Reactivity.js';
import { type PropsBase } from './MenuView/ViewBase.js';
import type { NavigationPayload } from './Navigation.js';
import {
  instantiateReactiveView,
  type ReactiveViewInstance,
} from './MenuView/ReactiveView.js';
import { isReactiveViewDefinition } from './views/reactive/reactiveViewDefinition.js';
import {
  getCurrentReactiveContext,
  setReactiveContext,
} from './ReactiveBuiltIns.js';
import { instantiateClassView } from './MenuView/ClassicView.js';
import { batch } from '@preact/signals-core';
import type { Props } from '../index.js';
import { render } from './render/render.js';
import type { Recursive } from './recursive.js';
import { ViewNode } from './dom/viewNode.js';
import { ViewContentNode } from './dom/viewContentNode.js';
import { ViewElementNode } from './dom/viewElementNode.js';
import { setCurrentOwner } from './render/owner.js';

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
  private queuedClears: PatchTargetBitField = 0;
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

  queueClear(patchTargets: PatchTargetBitField): void {
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
    for (const instance of this.instances.values()) {
      logger.debug(`Disposing instance.id=${instance.id}`, {
        isReactiveViewInstance: isReactiveViewInstance(instance),
        isRenderedReactiveViewV2:
          isReactiveViewInstance(instance) &&
          isRenderedReactiveViewV2(instance),
      });
      if (
        isReactiveViewInstance(instance) &&
        isRenderedReactiveViewV2(instance)
      ) {
        instance.dispose?.();
      }
    }
  }

  async patch(
    props: Props,
    targets: PatchTargetBitField,
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
    targets: PatchTargetBitField,
  ) {
    const $ = props.$;
    targets |= this.queuedClears;
    const payload: ViewMessagePayload = {};
    const prevContext = getCurrentReactiveContext();
    logger.debug('Patching reactive view', { targets, viewInstance: instance });
    try {
      // using _resource = withReactiveContext($);
      setReactiveContext($);
      batch(() => {
        if (isRenderedReactiveViewV2(instance)) {
          // Using V2 components
          logger.debug('Using V2 components');
          if (!targets && !this.hasQueuedComponents()) {
            logger.debug('No targets requested for V2 component instance.');
            return;
          }

          payload.flags = (payload.flags ?? 0) | MessageFlags.IsComponentsV2;
          this.patchContext = PatchTarget.Components;
          if (this.isQueuedForClear(PatchTarget.Components)) {
            payload.components = [];
          } else {
            if (!instance.root) {
              const [root, dispose] = render<ViewComponent>(
                () => instance.factory(),
                PatchTarget.Components,
              );
              instance.root = root;
              instance.dispose = dispose;
            }

            const flattened: ViewComponent[] = [];
            const stack: Recursive<ViewComponent | ViewNode<ViewComponent>>[] =
              [instance.root];
            const prevOwner = setCurrentOwner(instance.owner ?? null);
            try {
              while (stack.length) {
                const item = stack.pop();
                if (Array.isArray(item)) {
                  for (const inner of item) {
                    stack.push(inner);
                  }
                  continue;
                }
                if (item instanceof ViewContentNode) {
                  const content = item.getContent();
                  if (content) {
                    flattened.push(content);
                  }
                  continue;
                }
                if (item instanceof ViewElementNode) {
                  stack.push(item.children as ViewNode<any>[]);
                  continue;
                }
                if (item instanceof ViewNode) {
                  // How did we get here?
                  throw new Error(`Unhandled ViewNode: ${item}`);
                }
                if (item) {
                  flattened.push(item as any as ViewComponent);
                }
              }
            } finally {
              setCurrentOwner(prevOwner);
            }

            instance.lastRender = payload.components = flattened.toReversed();

            if (this.queuedComponents) {
              payload.components = this.resolveWithQueuedItems(
                payload.components,
                this.queuedComponents,
              );
            }
          }

          return;
        }

        if (instance.ephemeral !== undefined) {
          payload.ephemeral = instance.ephemeral;
        }
        if (targets & PatchTarget.Content) {
          this.patchContext = PatchTarget.Content;
          const content = instance.content;
          if (this.isQueuedForClear(PatchTarget.Content)) {
            payload.content = '';
          } else if (content !== undefined) {
            payload.content = read(content);
          }
        }
        if (targets & PatchTarget.Embeds || this.hasQueuedEmbeds()) {
          this.patchContext = PatchTarget.Embeds;
          if (this.isQueuedForClear(PatchTarget.Embeds)) {
            payload.embeds = [];
          } else {
            payload.embeds = DEPRECATED_flattenChildren(
              $,
              instance.embeds,
              this.patchContext,
            );
          }
          if (this.queuedEmbeds) {
            payload.embeds = this.resolveWithQueuedItems(
              payload.embeds,
              this.queuedEmbeds,
            );
          }
        }
        if (targets & PatchTarget.Components) {
          this.patchContext = PatchTarget.Components;
          if (this.isQueuedForClear(PatchTarget.Components)) {
            payload.components = [];
          } else if (instance.components !== undefined) {
            payload.components = DEPRECATED_flattenChildren(
              $,
              instance.components,
              this.patchContext,
            );
          }
        }
      });
    } finally {
      this.postRender();
      setReactiveContext(prevContext);
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
        // using _resource = withReactiveContext(props.$);
        const prevContext = getCurrentReactiveContext();
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
          setReactiveContext(prevContext);
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

  private isQueuedForClear(target: PatchTargetBitField): boolean {
    return !!(target & this.queuedClears);
  }
}
