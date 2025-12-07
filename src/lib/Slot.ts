import type { ViewNodeKindBase } from './dom/viewNodeKind.js';
import type { ViewComponent } from './views/viewFlavors.js';
import { type WritableSignal } from './reactivity/core/signals.js';
import { ViewManualComputedElementNode } from './dom/viewManualComputedElementNode.js';
import { getCurrentPatchTarget, patch, update } from './builtins/builtins.js';
import { PatchTarget } from './RenderingEngine.js';

class SlotNode extends ViewManualComputedElementNode<ViewNodeKindBase> {
  private readonly items: ViewNodeKindBase[] = [];
  private readonly patchTarget: PatchTarget;

  constructor(public ephemeral: boolean) {
    super();
    this.patchTarget = getCurrentPatchTarget() ?? PatchTarget.None;
  }

  dirty(): void {
    patch(this.patchTarget);
    update();
  }

  clear(): void {
    if (this.items.length !== 0) {
      this.items.length = 0;
      this.dirty();
    }
  }

  append(items: readonly ViewNodeKindBase[]) {
    this.items.push(...items);
    this.dirty();
  }

  unshift(items: readonly ViewNodeKindBase[]) {
    this.items.unshift(...items);
    this.dirty();
  }

  set(items: readonly ViewNodeKindBase[]) {
    this.items.length = 0;
    this.items.push(...items);
    this.dirty();
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed_ = true;
    this.items.length = 0;
  }

  override getFlattened() {
    if (!this.ephemeral) {
      return this.items;
    }

    const copy = [...this.items];
    this.items.length = 0;
    return copy;
  }
}

export class SlotImpl<T extends ViewNodeKindBase> {
  private writable?: WritableSignal<readonly T[]>;

  readonly node;

  constructor(ephemeral: boolean) {
    this.node = new SlotNode(ephemeral);
  }

  /**
   * Set if slot items should be cleared after being displayed.
   */
  setEphemeral(ephemeral: boolean) {
    this.node.ephemeral = ephemeral;
  }

  /**
   * Set the current list of elements in this slot.
   */
  set(...items: T[]): void {
    this.node.set(items);
  }

  /**
   * Appends a list of elements to this slot.
   */
  push(...elements: readonly T[]) {
    this.node.append(elements);
  }

  /**
   * Prepends a list of elements to this slot.
   */
  unshift(...elements: readonly T[]) {
    this.node.unshift(elements);
  }

  /**
   * Clears the current batch of elements in this slot.
   */
  clear(): void {
    if (!this.writable) return;

    if (this.writable.peek().length !== 0) {
      this.writable.set([]);
    }
  }
}

export type Slot<T extends ViewNodeKindBase> = Omit<SlotImpl<T>, 'node'>;

export interface SlotOptions {
  /**
   * Clear items list after items have been displayed.
   * @default false
   */
  ephemeral: boolean;
}

export function slot<T extends ViewNodeKindBase = ViewComponent>(
  options?: Partial<SlotOptions>,
): Slot<T> {
  return new SlotImpl(!!options?.ephemeral);
}

export function isSlot(value: unknown): value is Slot<ViewComponent> {
  return value instanceof SlotImpl;
}
