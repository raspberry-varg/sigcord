import { signal } from '../core/primitives/index.js';
import { effect, markDirty } from '../framework/hooks/index.js';

import { owner, useDisposeOwnerFn } from './owners/owner.js';
import { untracked } from './reactivity/untracked.js';
import { type DeferredNode, h } from './vdom/index.js';

import type { DisposeFn } from './render/dispose.js';

const isTruthy = (x: unknown) => !!x;

interface SlotProps {
  items: unknown[];
  ephemeral: boolean;
  subscribe: () => void;
}

function Slot({ items, ephemeral, subscribe }: SlotProps): unknown[] {
  const branchContainer: unknown[] = [];
  let prevDispose: DisposeFn | undefined;

  effect(() => {
    subscribe();

    if (prevDispose) {
      prevDispose();
      prevDispose = undefined;
    }

    prevDispose = owner(() => {
      branchContainer.length = 0;
      const toRender = [...items];
      if (ephemeral) {
        // Ephemeral is read-once.
        items.length = 0;
      }
      branchContainer.push(...toRender);
      return useDisposeOwnerFn();
    });

    markDirty();
  });

  return branchContainer;
}

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

  const [version, setVersion] = signal(0);
  const dirty = () => {
    setVersion(untracked(version) + 1);
  };

  let cachedNode: DeferredNode | undefined;
  const slotFn = () => {
    return (cachedNode ??= h(Slot, { items, ephemeral, subscribe: version }));
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
