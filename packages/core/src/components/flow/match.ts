import { getConfig } from '../../config.js';
import { OwnerTraceContext, OwnerTraceType } from '../../core/contexts/ownerTraceContext.js';
import { effect, markDirty } from '../../framework/hooks/index.js';
import { provideContextValue } from '../../lib/contexts/provideContext.js';
import { onCleanup } from '../../lib/hooks/onCleanup.js';
import { getOwnerOrThrow, owner, useDisposeOwnerFn } from '../../lib/owners/owner.js';
import { createBoundaryNode, isVDOMNode, NodeType, type ViewNode } from '../../lib/vdom/index.js';

import type { Signal } from '../../lib/reactivity/core/signals.js';
import type { JSXElement } from 'oxlint/plugins-dev';

interface BaseProps {
  isDefault?: true;
}

interface CaseData<Condition = unknown, T = unknown> extends BaseProps {
  when: Condition | Signal<Condition> | (() => Condition | Signal<Condition>);
  content: () => T;
}

interface DefaultData extends BaseProps {
  isDefault: true;
  content: () => unknown;
}

type Case = CaseData | DefaultData;

interface MatchProps {
  children: JSXElement[];
}

export function Match(...props: [MatchProps] | JSXElement[]): ViewNode[] {
  const rawChildren =
    props.length === 1 && !!props[0] && typeof props[0] === 'object' && 'children' in props[0]
      ? (props[0] as unknown as MatchProps).children
      : props;

  const cases: Array<CaseData | DefaultData> = [];
  for (let i = 0; i < rawChildren.length; i++) {
    let resolved: unknown = rawChildren[i];
    if (isVDOMNode(resolved) && resolved.$$typeof === NodeType.Deferred) {
      resolved = resolved.componentFn(resolved.props ?? {});
    }

    if (resolved == null || typeof resolved === 'boolean') {
      // Prune.
      continue;
    }

    if (
      !(
        typeof resolved === 'object' &&
        'content' in resolved &&
        typeof resolved.content === 'function'
      )
    ) {
      throwValidationError(i, resolved);
    }

    if ('isDefault' in resolved && resolved.isDefault === true) {
      cases.push({
        isDefault: true,
        content: resolved.content as () => unknown,
      });
      continue;
    }

    if ('when' in resolved) {
      cases.push({
        when: resolved.when as any,
        content: resolved.content as () => unknown,
      });
      continue;
    }

    throwValidationError(i, resolved);
  }

  let defaultIndex = -1;
  for (let i = 0; i < cases.length; i++) {
    if (cases[i].isDefault) {
      if (i !== cases.length - 1) throw new Error('<Default> must be the last child.');
      if (defaultIndex !== -1) throw new Error('Only one <Default> is allowed.');
      defaultIndex = i;
    }
  }

  const branchContainer: unknown[] = [];
  let prevDispose: (() => void) | undefined;
  effect(() => {
    if (prevDispose) {
      prevDispose();
      prevDispose = undefined;
    }

    const activeIndex = cases.findIndex(
      (c) => !c.isDefault && (typeof c.when === 'function' ? c.when() : c.when),
    );
    const finalIndex = activeIndex !== -1 ? activeIndex : defaultIndex;
    if (finalIndex === -1) {
      branchContainer.length = 0;
      markDirty();
      return;
    }

    const activeCase = cases[finalIndex];
    owner(
      () => {
        prevDispose = useDisposeOwnerFn();

        if (getConfig().componentStacks) {
          provideContextValue(
            OwnerTraceContext,
            activeCase.isDefault
              ? {
                  type: OwnerTraceType.ControlFlow,
                  name: 'Default',
                }
              : {
                  type: OwnerTraceType.ControlFlow,
                  name: 'Case',
                  details: `when: ${String(activeCase.when).slice(0, 100)}`,
                },
          );
        }

        const result =
          typeof activeCase.content === 'function' ? activeCase.content() : activeCase.content;
        branchContainer.length = 0;
        if (result != null && result !== false) {
          branchContainer[0] = createBoundaryNode(
            getOwnerOrThrow(),
            Array.isArray(result) ? result : [result],
          );
        }
      },
      {
        debugName: `[Match_${finalIndex === defaultIndex ? 'Default' : finalIndex}_Branch]`,
      },
    );

    markDirty();
  });

  onCleanup(() => {
    prevDispose?.();
  });

  return branchContainer as ViewNode[];
}

interface CaseProps<Condition = unknown> {
  when: () => Condition;
  children: () => unknown;
}

export function Case<Condition = unknown>(
  ...props: [CaseProps<Condition>] | [when: () => Condition, content: () => unknown]
): ViewNode {
  let when;
  let content;
  if (props.length === 1) {
    when = props[0].when;
    content = props[0].children;
  } else {
    when = props[0];
    content = props[1];
  }
  return {
    when,
    content,
  } satisfies CaseData<Condition> as unknown as ViewNode;
}

export function Default(show: () => unknown): ViewNode {
  return {
    isDefault: true,
    content: show,
  } satisfies DefaultData as unknown as ViewNode;
}

function throwValidationError(index: number, value: unknown): never {
  throw new Error(
    `(Match[${index}]) Invalid child. Expected <Case> or <Default>. Got: ${JSON.stringify(value)}`,
  );
}
