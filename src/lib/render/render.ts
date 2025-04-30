import type { ViewElementNode } from '../dom/viewElementNode.js';
import type { ViewNode } from '../dom/viewNode.js';
import type { ViewNodeKind } from '../dom/viewNodeKind.js';
import type { Children } from '../MenuView.js';
import type { PatchTarget } from '../RenderingEngine.js';
import type { DisposeFn } from './dispose.js';
import { owner } from './owner.js';

export function render<T extends ViewNodeKind>(
  renderFn: () => Children<T | ViewNode<T>>,
  patchTarget: PatchTarget,
): [root: ViewElementNode<T>, dispose: DisposeFn] {
  const o = owner(renderFn, patchTarget);
  return [o.root, o.dispose.bind(o)];
}
