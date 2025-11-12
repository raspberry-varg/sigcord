import type { BaseViewNodeKind, ViewNodeKind } from '../dom/viewNodeKind.js';
import { PatchTarget } from '../RenderingEngine.js';
import { render } from './render.js';
import { flatten } from './flatten.js';
import { setReactiveContext } from '../builtins/builtins.js';
import { STATIC_RENDER_SYNAPSE } from './staticRenderSynapse.js';

type StaticRenderFn<T extends BaseViewNodeKind> = () => ViewNodeKind<T>;

/**
 * Render a set of DIM-compatible reactive function components to a flattened
 * result. Dispose is called before the method is returned.
 *
 * @param renderFn
 * @returns
 */
export function staticRender<T extends BaseViewNodeKind>(
  renderFn: StaticRenderFn<T>,
): T[] {
  const prevContext = setReactiveContext(STATIC_RENDER_SYNAPSE);
  let flattened, disposeFn;
  try {
    const [root, dispose, owner] = render(renderFn, PatchTarget.None);
    flattened = flatten(root, owner);
    disposeFn = dispose;
  } finally {
    setReactiveContext(prevContext);
  }

  disposeFn();
  return flattened;
}
