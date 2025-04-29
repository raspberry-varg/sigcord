import type { ViewComponent } from './MenuView.js';
import { writable } from './ReactiveBuiltIns.js';
import type { Signal, WritableSignal } from './Reactivity.js';

export const SLOT_ENQUEUE_FLUSH_METHOD: unique symbol =
  Symbol('Flush accessor');

export class SlotImpl<T> {
  private writable?: WritableSignal<readonly T[]>;
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
   * Preprends a list of elements to this slot.
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

  registerEffect(): void {}
}

export interface Slot<T>
  extends Omit<SlotImpl<T>, typeof SLOT_ENQUEUE_FLUSH_METHOD> {}

export interface SlotOptions<T> {
  initial: T[];
  ephemeral: boolean;
}

export function slot(
  options?: Partial<SlotOptions<ViewComponent>>,
): Slot<ViewComponent> {
  return new SlotImpl(options?.initial, options?.ephemeral);
}

export function isSlot(value: unknown): value is Slot<ViewComponent> {
  return value instanceof SlotImpl;
}
