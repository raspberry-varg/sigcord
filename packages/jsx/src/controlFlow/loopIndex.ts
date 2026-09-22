import {
  batch,
  createOwner,
  effect,
  getConfig,
  getOwner,
  isSignal,
  markDirty,
  onCleanup,
  type Owner,
  OwnerBoundaryViewNode,
  OwnerTraceContext,
  OwnerTraceType,
  provideContextValue,
  renderFragment,
  runWithOwner,
  type Setter,
  signal,
  type Signal,
  untracked,
  ViewElementNode,
  ViewNodeLegacy,
  type ViewNodeKind,
} from '@sigcord/core';

interface IndexProps<Each extends Iterable<unknown> | Signal<Iterable<unknown>>> {
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
export function Index<Each extends Iterable<unknown> | Signal<Iterable<unknown>>>(
  props: IndexProps<Each>,
): ViewElementNode | ViewNodeKind[] {
  const parentOwner = getOwner();
  const each = props.each;
  if (!isSignal(each)) {
    let index = 0;
    return untracked(() => {
      const out: ViewNodeLegacy | ViewNodeKind[] = [];
      for (const item of each as Exclude<Each, Signal<unknown>>) {
        let rendered;
        if (!getConfig().componentStacks) {
          rendered = props.children(item as any, index++);
        } else {
          const childOwner = createOwner(parentOwner);
          const childOut = runWithOwner(childOwner, () => {
            const debugName = props.debugName ? `name: "${props.debugName}", ` : '';
            provideContextValue(OwnerTraceContext, {
              type: OwnerTraceType.ControlFlow,
              name: 'Iteration',
              details: `${debugName}index: ${index}`,
            });
            return renderFragment(() => props.children(item as any, index++));
          });
          rendered = new OwnerBoundaryViewNode(childOwner, childOut);
        }
        out.push(rendered);
      }
      return out;
    });
  }

  const node = new ViewElementNode();

  let prevItems: unknown[] = [];
  let prevOwners: Owner[] = [];
  let prevSetters: Setter<unknown>[] = [];
  let prevNodes: ViewNodeLegacy[] = [];

  onCleanup(() => {
    for (let i = 0; i < prevOwners.length; i++) {
      prevOwners[i].dispose();
    }
  });

  const effectFn = () => {
    const nextItems: unknown[] = Array.from(each());
    const newOwners = new Array(nextItems.length);
    const nextSetters = new Array(nextItems.length);
    const nextNodes: typeof prevNodes = new Array(nextItems.length);

    const existingMin = Math.min(prevItems.length, nextItems.length);

    for (let i = 0; i < existingMin; i++) {
      prevSetters[i](nextItems[i]);

      nextSetters[i] = prevSetters[i];
      newOwners[i] = prevOwners[i];
      nextNodes[i] = prevNodes[i];
    }

    for (let i = existingMin; i < nextItems.length; i++) {
      const [get, set] = signal(nextItems[i] as Each[keyof Each]);
      nextSetters[i] = set;

      let nodes;
      const childOwner = createOwner(parentOwner);
      runWithOwner(childOwner, () => {
        const debugName = props.debugName ? `name: "${props.debugName}", ` : '';
        provideContextValue(OwnerTraceContext, {
          type: OwnerTraceType.ControlFlow,
          name: 'Iteration',
          details: `${debugName}index: ${i}`,
        });

        nodes = renderFragment(() => props.children(get as any, i));
      });
      nextNodes[i] = new OwnerBoundaryViewNode(childOwner, nodes!);
      node.addChild(nextNodes[i]);
      newOwners[i] = childOwner;
    }

    for (let i = nextItems.length; i < prevItems.length; i++) {
      node.removeChild(prevNodes[i]);
      prevOwners[i].dispose();
    }

    prevItems = nextItems;
    prevOwners = newOwners;
    prevSetters = nextSetters;
    prevNodes = nextNodes;
  };
  effect(() => {
    batch(effectFn);
    markDirty();
  });

  return node;
}
