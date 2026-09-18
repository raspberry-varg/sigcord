import { ViewElementNode } from '../dom/viewElementNode.js';
import type { ViewNodeKind, ViewNodeKindBase } from '../dom/viewNodeKind.js';
import type { DisposeFn } from './dispose.js';
import { getOwnerOrThrow, type Owner, owner } from '../owners/owner.js';
import { flattenToContentNodes } from './flattenToContentNodes.js';
import type { Recursive } from '../recursive.js';
import type { ViewNode } from '../dom/viewNode.js';
import { untracked } from '../reactivity/untracked.js';
import { provideContextValue } from '../contexts/provideContext.js';
import { PatchTargetContext } from '../../framework/hooks/usePatchTarget.js';
import { PatchTarget } from '../../framework/patchTarget.js';

export function render<T extends ViewNodeKindBase>(
  into: ViewElementNode<T>,
  renderFn: () => ViewNodeKind<T>,
  patchTarget?: PatchTarget,
): [dispose: DisposeFn, owner: Owner] {
  const o = owner(() => {
    if (patchTarget != null) {
      provideContextValue(PatchTargetContext, patchTarget);
    }
    into.setChildren(...renderFragment(renderFn));
    return getOwnerOrThrow();
  });
  return [() => o.dispose(), o];
}

export function renderFragment<T extends ViewNodeKindBase>(
  renderFn: () => ViewNodeKind<T>,
): Array<ViewNode<T>> {
  const content = untracked(renderFn) as Recursive<T>;
  return flattenToContentNodes(content);
}

export function renderRoot<T extends ViewNodeKindBase>(
  renderFn: () => ViewNodeKind<T>,
  patchTarget: PatchTarget,
): DisposeFn {
  const [dispose] = render(new ViewElementNode<T>(), renderFn, patchTarget);
  return dispose;
}
