import { markDirty, update } from '../framework/hooks/index.js';

import { getOwner, runWithOwner } from './owners/owner.js';

const isTruthy = (x: unknown) => !!x;

export interface Slot<_T = any> {
  setEphemeral(isEphemeral: boolean): void;
  set(...items: unknown[]): void;
  push(...items: unknown[]): void;
  unshift(...items: unknown[]): void;
  clear(): void;
}

export interface SlotOptions {
  /**
   * Clear item list after items have been displayed.
   * @default false
   */
  ephemeral: boolean;
}

export function slot<T = any>(options?: Partial<SlotOptions>): Slot<T> {
  let items: unknown[] = [];
  let ephemeral = !!options?.ephemeral;

  const capturedOwner = getOwner();

  const dirty = () => {
    runWithOwner(capturedOwner, () => {
      markDirty();
      update();
    });
  };

  const slotFn = () => {
    if (!ephemeral) return items;

    // Ephemeral is read-once.
    const copy = [...items];
    items = [];
    return copy;
  };

  slotFn.setEphemeral = ((isEphemeral: boolean) => {
    ephemeral = isEphemeral;
  }) satisfies Slot['setEphemeral'];

  slotFn.set = ((...newItems: unknown[]) => {
    items = newItems.filter(isTruthy);
    dirty();
  }) satisfies Slot['set'];

  slotFn.push = ((...newItems: unknown[]) => {
    const filtered = newItems.filter(isTruthy);
    if (!filtered.length) return;
    items.push(...filtered);
    dirty();
  }) satisfies Slot['push'];

  slotFn.unshift = ((...newItems: unknown[]) => {
    const filtered = newItems.filter(isTruthy);
    if (!filtered.length) return;
    items.unshift(...filtered);
    dirty();
  }) satisfies Slot['unshift'];

  slotFn.clear = (() => {
    if (items.length !== 0) {
      items = [];
      dirty();
    }
  }) satisfies Slot['clear'];

  return slotFn satisfies Slot;
}
