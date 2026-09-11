import { ViewElementNode } from '../dom/viewElementNode.js';
import type { ViewNodeKind, ViewNodeKindBase } from '../dom/viewNodeKind.js';
import type { PatchTarget } from '../RenderingEngine.js';
import type { DisposeFn } from './dispose.js';
import { type Owner, ownerLite } from '../owners/owner.js';
import { onCleanup } from '../hooks/onCleanup.js';
import { flattenToContentNodes } from './flattenToContentNodes.js';
import type { Recursive } from '../recursive.js';
import type { ViewNode } from '../dom/viewNode.js';
import { untracked } from '../reactivity/untracked.js';
import { getCurrentPatchTarget } from '../builtins/builtins.js';

export function render<T extends ViewNodeKindBase>(
  into: ViewElementNode<T>,
  renderFn: () => ViewNodeKind<T>,
  patchTarget?: PatchTarget,
): [dispose: DisposeFn, owner: Owner] {
  const o = ownerLite(() => {
    into.setChildren(...renderFragment(renderFn));
    onCleanup(into.reset.bind(into));
  }, patchTarget ?? getCurrentPatchTarget());
  return [o.dispose.bind(o), o];
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
