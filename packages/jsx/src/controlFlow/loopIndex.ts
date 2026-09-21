import {
  type DisposeFn,
  type Setter,
  type Signal,
  ViewElementNode,
  ViewNode,
  type ViewNodeKind,
  batch,
  effect,
  isSignal,
  markDirty,
  onCleanup,
  owner,
  renderFragment,
  signal,
  untracked,
  useDisposeOwnerFn,
  provideContextValue,
  OwnerTraceContext,
  OwnerTraceType,
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
  const each = props.each;
  if (!isSignal(each)) {
    return untracked(() => Array.from(each, (r, i) => props.children(r as any, i)));
  }

  const node = new ViewElementNode();

  let prevItems: unknown[] = [];
  let prevDisposeFns: DisposeFn[] = [];
  let prevSetters: Setter<unknown>[] = [];
  let prevNodes: Array<ViewNode[]> = [];

  onCleanup(() => {
    for (let i = 0; i < prevDisposeFns.length; i++) {
      prevDisposeFns[i]();
    }
  });

  const effectFn = () => {
    const nextItems: unknown[] = Array.from(each());
    const nextDisposeFns = new Array(nextItems.length);
    const nextSetters = new Array(nextItems.length);
    const nextNodes: typeof prevNodes = new Array(nextItems.length);

    const existingMin = Math.min(prevItems.length, nextItems.length);

    for (let i = 0; i < existingMin; i++) {
      prevSetters[i](nextItems[i]);

      nextSetters[i] = prevSetters[i];
      nextDisposeFns[i] = prevDisposeFns[i];
      nextNodes[i] = prevNodes[i];
    }

    for (let i = existingMin; i < nextItems.length; i++) {
      const [get, set] = signal(nextItems[i] as Each[keyof Each]);
      nextSetters[i] = set;

      let nodes;
      const dispose = owner(
        () => {
          const debugName = props.debugName ? `name: "${props.debugName}", ` : '';
          provideContextValue(OwnerTraceContext, {
            type: OwnerTraceType.ControlFlow,
            name: 'Iteration',
            details: `${debugName}index: ${i}`,
          });

          nodes = renderFragment(() => props.children(get as any, i));
          return useDisposeOwnerFn();
        },
        {
          debugName: `[Loop_Index_${i}]${props.debugName ?? '%'}`,
        },
      );
      nextNodes[i] = nodes!;
      node.addChild(...nextNodes[i]);
      nextDisposeFns[i] = dispose;
    }

    for (let i = nextItems.length; i < prevItems.length; i++) {
      node.removeMany(prevNodes[i]);
      prevDisposeFns[i]();
    }

    prevItems = nextItems;
    prevDisposeFns = nextDisposeFns;
    prevSetters = nextSetters;
    prevNodes = nextNodes;
  };
  effect(() => {
    batch(effectFn);
    markDirty();
  });

  return node;
}
