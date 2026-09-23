import {
  computed,
  effect,
  isSignal,
  markDirty,
  owner,
  OwnerTraceContext,
  OwnerTraceType,
  provideContextValue,
  read,
  type Signal,
  untracked,
  useDisposeOwnerFn,
  type ViewNode,
} from '@sigcord/core';

type Then<Condition> = (
  result: Condition extends Signal<infer C> | (() => infer C)
    ? Signal<NonNullable<C>>
    : NonNullable<Condition>,
) => unknown;

interface BaseProps<Condition> {
  cond: Condition;
  debugName?: string;
}

interface WithChildren<Condition> extends BaseProps<Condition> {
  children: Then<Condition>;
}

interface WithAttributes<Condition> extends BaseProps<Condition> {
  then: Then<Condition>;
  else?: () => unknown;
}

type IfProps<Condition> = WithChildren<Condition> | WithAttributes<Condition>;

export function If<Condition>(props: Readonly<IfProps<Condition>>): ViewNode[] {
  const cond = props.cond;
  const then = 'then' in props ? props.then : props.children;
  if (!isSignal(cond)) {
    return untracked(() =>
      cond ? then(cond as Parameters<typeof then>[0]) : 'else' in props ? props.else : null,
    ) as ViewNode[];
  }

  const branchContainer: unknown[] = [];

  const truthy = computed(() => !!read<Condition>(cond as Condition));
  effect(() => {
    const res = truthy();
    const dispose = owner(
      () => {
        const debugName = props.debugName ? `name: "${props.debugName}", ` : '';
        provideContextValue(OwnerTraceContext, {
          type: OwnerTraceType.ControlFlow,
          name: 'Branch',
          details: `${debugName}active: ${res ? 'then' : 'else'}`,
        });

        branchContainer.length = 0;
        let newVDOM: unknown = null;
        if (res) {
          newVDOM = then(cond as Parameters<typeof then>[0]);
        } else if ('else' in props && props.else) {
          newVDOM = props.else();
        }

        // Mutate the stable array pointer in-place!
        branchContainer.length = 0;
        if (newVDOM != null && newVDOM !== false) {
          if (Array.isArray(newVDOM)) {
            branchContainer.push(...newVDOM);
          } else {
            branchContainer.push(newVDOM);
          }
        }

        return useDisposeOwnerFn();
      },
      {
        debugName: `[If_${res ? 'True' : 'False'}_Branch]${props.debugName ?? '%'}`,
      },
    );

    markDirty();
    return dispose;
  });

  return branchContainer as ViewNode[];
}
