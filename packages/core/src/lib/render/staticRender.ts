import type { ViewNodeKind, ViewNodeKindBase } from '../dom/viewNodeKind.js';
import { PatchTarget } from '../RenderingEngine.js';
import { render } from './render.js';
import { flatten } from './flatten.js';
import { setCurrentSynapse } from '../builtins/builtins.js';
import { STATIC_RENDER_SYNAPSE } from './staticRenderSynapse.js';
import { ViewElementNode } from '../dom/viewElementNode.js';

type StaticRenderFn<T extends ViewNodeKindBase> = () => ViewNodeKind<T>;

/**
 * Render a set of DIM-compatible reactive function components to a flattened
 * result. Dispose is called before the method is returned.
 *
 * @param renderFn
 * @returns
 */
export function staticRender<T extends ViewNodeKindBase>(
  renderFn: StaticRenderFn<ViewNodeKindBase>,
): T[] {
  const prevContext = setCurrentSynapse(STATIC_RENDER_SYNAPSE);
  let flattened, disposeFn;
  try {
    const root = new ViewElementNode();
    const [dispose, owner] = render(root, renderFn, PatchTarget.None);
    flattened = flatten(root, owner);
    disposeFn = dispose;
  } finally {
    setCurrentSynapse(prevContext);
  }

  disposeFn();
  return flattened as T[];
}
