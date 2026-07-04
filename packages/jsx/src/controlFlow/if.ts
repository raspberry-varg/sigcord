import {
  type Children,
  HasWritableSignalStamp,
  type Owner,
  type Signal,
  ViewElementNode,
  type ViewNodeKind,
  type ViewNodeKindBase,
  type WritableSignal,
  computed,
  isSignal,
  isWritableSignal,
  owner,
  patchEffect,
  read,
  untracked,
} from '@sigcord/core';

type Then<Condition, T_TRUE> = (
  result: Condition extends
    | Signal<infer C>
    | WritableSignal<infer C>
    | (() => infer C)
    ? Signal<NonNullable<C>>
    : NonNullable<Condition>,
) => T_TRUE;

interface BaseProps<Condition> {
  cond: Condition;
  debugName?: string;
}

interface WithChildren<Condition, T_TRUE> extends BaseProps<Condition> {
  children: Then<Condition, T_TRUE>;
}

interface WithAttributes<Condition, T_TRUE, T_FALSE>
  extends BaseProps<Condition> {
  then: Then<Condition, T_TRUE>;
  else?: () => T_FALSE;
}

type IfProps<Condition, T_TRUE, T_FALSE> =
  | WithChildren<Condition, T_TRUE>
  | WithAttributes<Condition, T_TRUE, T_FALSE>;

export function If<Condition, T_TRUE, T_FALSE>(
  props: IfProps<Condition, T_TRUE, T_FALSE>,
): T_TRUE & T_FALSE extends Children<infer C>
  ? ViewElementNode<C> | C
  : ViewElementNode<ViewNodeKind> | ViewNodeKind {
  const then = 'then' in props ? props.then : props.children;

  let resolved: unknown = props.cond;
  if (HasWritableSignalStamp(resolved) && isWritableSignal(resolved)) {
    resolved = resolved.readonly();
  }

  if (!isSignal(resolved)) {
    return untracked(() =>
      resolved
        ? then(resolved as Parameters<typeof then>[0])
        : 'else' in props
          ? props.else
          : null,
    ) as any;
  }

  const truthy = computed(() => !!read<Condition>(resolved as Condition));

  const node = new ViewElementNode();
  patchEffect(() => {
    let o: Owner | undefined;
    const res = truthy();
    if (res) {
      const then = 'then' in props ? props.then : props.children;
      o = owner(
        () =>
          untracked(() =>
            then(resolved as Parameters<typeof then>[0]),
          ) as ViewNodeKindBase,
      );
    } else if ('else' in props) {
      o = owner(() => untracked(() => props.else?.()) as ViewNodeKindBase);
    }
    if (o) {
      o.debugName = `[If_${res ? 'True' : 'False'}_Branch]${props.debugName ?? '%'}`;
      node.addChild(o.root);
    }
    return () => o?.dispose();
  });

  return node as any;
}
