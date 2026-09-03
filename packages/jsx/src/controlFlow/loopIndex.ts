import {
  Owner,
  type Setter,
  type Signal,
  ViewElementNode,
  type ViewNodeKind,
  batch,
  isSignal,
  onCleanup,
  owner,
  patchEffect,
  signal,
  untracked,
} from '@sigcord/core';

interface IndexProps<
  Each extends Iterable<unknown> | Signal<Iterable<unknown>>,
> {
  each: Each;
  children: (
    item: Each extends Signal<Iterable<infer U>>
      ? Signal<U>
      : Each extends Iterable<infer U>
        ? U
        : never,
    index: number,
  ) => ViewNodeKind;
  debugName?: string;
}

/**
 * Render a series of components based on an incoming list.
 *
 * Items are "slotted in" at each index rather than being moved around in their
 * entirety.
 */
export function Index<
  Each extends Iterable<unknown> | Signal<Iterable<unknown>>,
>(props: IndexProps<Each>): ViewElementNode<ViewNodeKind> | ViewNodeKind[] {
  const each = props.each;
  if (!isSignal(each)) {
    return untracked(() =>
      Array.from(each, (r, i) => props.children(r as any, i)),
    );
  }

  const node = new ViewElementNode();

  let prevItems: unknown[] = [];
  let prevOwners: Owner[] = [];
  let prevSetters: Setter<unknown>[] = [];

  onCleanup(() => {
    for (let i = 0; i < prevOwners.length; i++) {
      prevOwners[i].dispose();
    }
  });

  const effectFn = () => {
    const nextItems: unknown[] = Array.from(each());
    const nextOwners = new Array(nextItems.length);
    const nextSetters = new Array(nextItems.length);

    const existingMin = Math.min(prevItems.length, nextItems.length);

    for (let i = 0; i < existingMin; i++) {
      prevSetters[i](nextItems[i]);

      nextSetters[i] = prevSetters[i];
      nextOwners[i] = prevOwners[i];
    }

    for (let i = existingMin; i < nextItems.length; i++) {
      const [get, set] = signal(nextItems[i] as Each[keyof Each]);
      nextSetters[i] = set;

      const o = owner(() => {
        return untracked(() => props.children(get as any, i));
      });
      o.debugName = `[Loop_Index_${i}]${props.debugName ?? '%'}`;
      node.addChild(o.root);

      nextOwners[i] = o;
    }

    for (let i = nextItems.length; i < prevItems.length; i++) {
      prevOwners[i].dispose();
    }

    prevItems = nextItems;
    prevOwners = nextOwners;
    prevSetters = nextSetters;
  };
  patchEffect(() => batch(effectFn));

  return node;
}
