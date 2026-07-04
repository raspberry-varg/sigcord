import {
  DeferredComponent,
  type DisposeFn,
  type Signal,
  ViewElementNode,
  type ViewNodeKind,
  type ViewNodeKindBase,
  onCleanup,
  owner,
  patchEffect,
  untracked,
} from '@sigcord/core';

import {type JSXElement, type JSXNode} from '../index.js';

interface BaseProps {
  isDefault?: true;
}

interface CaseData<Condition = unknown, T = unknown> extends BaseProps {
  when: () => Condition | Signal<Condition>;
  content: () => T;
}

interface DefaultData extends BaseProps {
  isDefault: true;
  content: () => ViewNodeKind;
}

type Case = CaseData | DefaultData;

interface MatchProps {
  children: JSXElement[];
}

export function Match(
  ...props: [MatchProps] | JSXElement[]
): ViewElementNode<ViewNodeKind> {
  const node = new ViewElementNode();
  let dispose: DisposeFn | undefined;
  const cases = (
    props.length === 1 &&
    !!props[0] &&
    typeof props[0] === 'object' &&
    'children' in props[0]
      ? (props[0] as unknown as MatchProps).children
      : props
  ).map((child, index) => {
    if (child instanceof DeferredComponent) {
      child = child.execute();
    }

    if (!child || typeof child !== 'object') {
      throw new Error(
        `(Match[${index}]) Provided child to <Match> was not an object. Was <Case> or <Default> used?`,
      );
    }

    if (!('when' in child && 'content' in child)) {
      throw new Error(
        `(Match[${index}]) Match expects one or more <Case> children, and an optional <Default> child. Got: ${JSON.stringify(child, null, 2)}`,
      );
    }

    return child as unknown as Case;
  });

  patchEffect(() => {
    let i = 0;
    let activeCaseIndex = -1;
    let defaultIndex = -1;
    for (const c of cases) {
      if (c.isDefault) {
        if (i !== cases.length - 1) {
          throw new Error('Default case must be at the end.');
        }
        if (defaultIndex !== -1) {
          throw new Error('A Default case has already been defined.');
        }
        defaultIndex = i;
        continue;
      }
      const result = c.when();
      if (result) {
        activeCaseIndex = i;
        break;
      }

      i++;
    }

    let finalIndex = activeCaseIndex;
    if (finalIndex === -1) {
      if (defaultIndex === -1) {
        dispose?.();
        dispose = undefined;
        return;
      }
      finalIndex = defaultIndex;
    }

    dispose?.();
    const c = cases[finalIndex];
    const o = owner(() => untracked(() => c.content()) as ViewNodeKindBase);
    node.clear();
    node.setChildren(o.root);
    dispose = o.dispose.bind(o);
  });

  onCleanup(() => {
    dispose?.();
  });

  return node;
}

interface CaseProps<Condition = unknown> {
  when: () => Condition;
  children: () => unknown;
}

export function Case<Condition = unknown>(
  ...props:
    | [CaseProps<Condition>]
    | [when: () => Condition, content: () => unknown]
): JSXNode {
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
  } satisfies CaseData<Condition> as unknown as JSXNode;
}

export function Default(show: () => ViewNodeKind): JSXNode {
  return {
    isDefault: true,
    content: show,
  } satisfies DefaultData as unknown as JSXNode;
}
