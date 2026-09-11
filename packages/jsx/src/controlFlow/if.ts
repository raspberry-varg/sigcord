import {
  type Children,
  type Signal,
  ViewElementNode,
  type ViewNodeKind,
  computed,
  isSignal,
  patchEffect,
  read,
  render,
  untracked,
} from '@sigcord/core';

type Then<Condition, T_TRUE> = (
  result: Condition extends Signal<infer C> | (() => infer C)
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

interface WithAttributes<
  Condition,
  T_TRUE,
  T_FALSE,
> extends BaseProps<Condition> {
  then: Then<Condition, T_TRUE>;
  else?: () => T_FALSE;
}

type IfProps<Condition, T_TRUE, T_FALSE> =
  WithChildren<Condition, T_TRUE> | WithAttributes<Condition, T_TRUE, T_FALSE>;

export function If<Condition, T_TRUE, T_FALSE>(
  props: Readonly<IfProps<Condition, T_TRUE, T_FALSE>>,
): T_TRUE & T_FALSE extends Children<infer C>
  ? ViewElementNode<C> | C
  : ViewElementNode<ViewNodeKind> | ViewNodeKind {
  const cond = props.cond;
  const then = 'then' in props ? props.then : props.children;
  if (!isSignal(cond)) {
    return untracked(() =>
      cond
        ? then(cond as Parameters<typeof then>[0])
        : 'else' in props
          ? props.else
          : null,
    ) as any;
  }

  const node = new ViewElementNode();
  const truthy = computed(() => !!read<Condition>(cond as Condition));
  patchEffect(() => {
    let renderFn: () => ViewNodeKind;
    const res = truthy();
    if (res) {
      const then = 'then' in props ? props.then : props.children;
      renderFn = () => then(cond as Parameters<typeof then>[0]) as ViewNodeKind;
    } else if ('else' in props) {
      renderFn = () => props.else?.() as ViewNodeKind;
    } else {
      renderFn = () => null;
    }
    const [dispose, o] = render(node, renderFn, /* patchTarget= */ undefined);
    o.debugName = `[If_${res ? 'True' : 'False'}_Branch]${props.debugName ?? '%'}`;
    return dispose;
  });

  return node as any;
}
