import { OwnerTraceContext, OwnerTraceType } from '../../core/contexts/ownerTraceContext.js';
import { computed } from '../../core/primitives/index.js';
import { effect, markDirty } from '../../framework/hooks/index.js';
import { provideContextValue } from '../../lib/contexts/provideContext.js';
import { getOwnerOrThrow, owner, useDisposeOwnerFn } from '../../lib/owners/owner.js';
import { read } from '../../lib/reactivity/core/read.js';
import { isSignal, isWritableSignal, type Signal } from '../../lib/reactivity/core/signals.js';
import { untracked } from '../../lib/reactivity/untracked.js';
import { createBoundaryNode, type ViewNode } from '../../lib/vdom/index.js';

type WhenTruthy<Condition> = (
  result: Condition extends Signal<infer C> | (() => infer C)
    ? Signal<NonNullable<C>>
    : NonNullable<Condition>,
) => unknown;

interface ShowProps<T> {
  when: T;
  children: WhenTruthy<T>;
  fallback?: () => unknown;
  debugName?: string;
}

/**
 * Render JSX when a condition is truthy. Supports a fallback branch.
 *
 * If a signal is provided, the branch only re-evaluates when the truthiness of the signal changes,
 * not the value.
 */
export function Show<T>(props: ShowProps<T>): ViewNode[] {
  const when = props.when;
  const branch = props.children;
  const fallback = props.fallback;

  if (!isSignal(when) && !isWritableSignal(when)) {
    return untracked(() =>
      when ? branch(when as any) : fallback ? fallback() : null,
    ) as ViewNode[];
  }

  const branchContainer: unknown[] = [];

  const truthy = computed(() => !!read<T>(when as T));
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

        let newVDOM: unknown = null;
        if (res) {
          newVDOM = branch(when as Parameters<typeof branch>[0]);
        } else if (fallback) {
          newVDOM = fallback();
        }

        branchContainer.length = 0;
        if (newVDOM != null && newVDOM !== false) {
          branchContainer[0] = createBoundaryNode(
            getOwnerOrThrow(),
            Array.isArray(newVDOM) ? newVDOM : [newVDOM],
          );
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

interface BaseProps<Condition> {
  cond: Condition;
  debugName?: string;
}

interface WithChildren<Condition> extends BaseProps<Condition> {
  children: WhenTruthy<Condition>;
}

/**
 * @deprecated Use children with fallback instead.
 */
interface WithAttributes<Condition> extends BaseProps<Condition> {
  then: WhenTruthy<Condition>;
  else?: () => unknown;
}

type IfProps<Condition> = WithChildren<Condition> | WithAttributes<Condition>;

/**
 * @deprecated Use {@link Show} instead.
 */
export function If<Condition>(props: Readonly<IfProps<Condition>>): ViewNode[] {
  const cond = props.cond;
  const then = 'then' in props ? props.then : props.children;
  const fallback = 'else' in props ? props.else : undefined;

  return Show({
    when: cond,
    children: then,
    fallback,
    debugName: props.debugName,
  });
}
