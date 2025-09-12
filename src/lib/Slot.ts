import { ViewElementNode } from './dom/viewElementNode.js';
import type { ViewNodeKind } from './dom/viewNodeKind.js';
import type { ViewComponent } from './MenuView.js';
import { patch } from './ReactiveBuiltIns.js';
import { writable } from './primitives.js';
import {
  createEffect,
  read,
  type Signal,
  type WritableSignal,
} from './Reactivity.js';
import { flattenToContentNodes } from './render/flattenToContentNodes.js';
import { getOpenOwner } from './render/owner.js';
import { PatchTarget } from './RenderingEngine.js';

const SLOT_ENQUEUE_FLUSH_METHOD: unique symbol = Symbol('Flush accessor');

class SlotImpl<T extends ViewNodeKind> {
  private writable?: WritableSignal<readonly T[]>;
  private rootNode?: ViewElementNode<T>;
  private flushQueued = false;

  constructor(
    public initialElements: readonly T[] | undefined = [],
    private ephemeral = true,
  ) {}

  /**
   * Get this slot as a signal to insert in other components.
   */
  get signal(): Signal<readonly T[]> {
    return this.getWritable().readonly();
  }

  get root(): ViewElementNode<T> {
    if (this.rootNode) return this.rootNode;

    const root = new ViewElementNode<T>();
    const openOwner = getOpenOwner();
    const patchTarget = openOwner?.patchTarget ?? PatchTarget.None;
    const dispose = createEffect(() => {
      patch(patchTarget);
      const value = read<T[]>(this.signal as () => T[]);
      for (const el of value) {
        const node = new ViewElementNode();
        node.addChild(...flattenToContentNodes(el));
        root.addChild(node);
      }
      // TODO: @raspberry-varg - Have this called by someone else cause this won't flush without an update.
      (this as SlotImpl<T>)[SLOT_ENQUEUE_FLUSH_METHOD]();

      return () => {
        root.clear();
      };
    });
    openOwner?.registerDisposal(dispose);
    return (this.rootNode = root);
  }

  /**
   * Update the current list of elements in this slot.
   */
  update(updaterFn: (prev: readonly T[]) => readonly T[]): void {
    this.maybeFlush();
    this.getWritable().update(updaterFn);
  }

  /**
   * Appends a list of elements to this slot.
   */
  push(...elements: readonly T[]) {
    if (elements.length === 0) return;
    this.update((prev) => [...prev, ...elements]);
  }

  /**
   * Prepends a list of elements to this slot.
   */
  unshift(...elements: readonly T[]) {
    if (elements.length === 0) return;
    this.update((prev) => [...elements, ...prev]);
  }

  /**
   * Clears the current batch of elements in this slot.
   */
  clear(): void {
    if (this.writable?.peek().length !== 0) {
      this.writable?.set([]);
    }
  }

  private getWritable(): WritableSignal<readonly T[]> {
    if (this.writable) {
      return this.writable;
    }
    const initialValue = this.initialElements ?? [];
    delete this.initialElements;
    return (this.writable ??= writable(initialValue));
  }

  private maybeFlush(): void {
    if (this.flushQueued) {
      this.flushQueued = false;
      if (this.ephemeral) {
        const values = this.writable?.peek();
        if (values && values.length > 0) {
          // TODO: @raspberry-varg - Maybe refactor to use a computed instead?
          // This prevents upstream signal updates during this render cycle.
          (values as T[]).length = 0;
        }
      }
    }
  }

  /**
   * @internal
   */
  [SLOT_ENQUEUE_FLUSH_METHOD](): void {
    this.flushQueued = true;
    if (this.ephemeral) {
      const values = this.writable?.peek();
      if (values && values.length > 0) {
        // TODO: @raspberry-varg - Maybe refactor to use a computed instead?
        // This prevents upstream signal updates during this render cycle.
        (values as T[]).length = 0;
      }
    }
  }
}

export interface Slot<T extends ViewNodeKind>
  extends Omit<SlotImpl<T>, typeof SLOT_ENQUEUE_FLUSH_METHOD> {}

export interface SlotOptions {
  ephemeral: boolean;
}

export function slot<T extends ViewNodeKind = ViewComponent>(
  options?: Partial<SlotOptions>,
  ...initialValue: T[]
): Slot<T> {
  return new SlotImpl(initialValue, options?.ephemeral);
}

export function isSlot(value: unknown): value is Slot<ViewComponent> {
  return value instanceof SlotImpl;
}
