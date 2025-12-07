import type { ViewElementNode } from '../dom/viewElementNode.js';
import type { ViewNodeKindBase } from '../dom/viewNodeKind.js';
import type { Children } from '../views/viewFlavors.js';
import type { PatchTarget } from '../RenderingEngine.js';
import type { DisposeFn } from './dispose.js';
import { owner, type Owner } from './owner.js';

export function render<T extends ViewNodeKindBase>(
  renderFn: () => T | Children<T>,
  patchTarget: PatchTarget,
): [root: ViewElementNode<T>, dispose: DisposeFn, owner: Owner<T>] {
  const o = owner<T>(renderFn, patchTarget);
  return [o.root, o.dispose.bind(o), o];
}
