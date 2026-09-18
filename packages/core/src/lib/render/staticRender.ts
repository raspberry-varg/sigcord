import type { ViewNodeKind, ViewNodeKindBase } from '../dom/viewNodeKind.js';
import { render } from './render.js';
import { flatten } from './flatten.js';
import { SYNAPSE_CONTEXT_ID } from '../builtins/builtins.js';
import { STATIC_RENDER_SYNAPSE } from './staticRenderSynapse.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import { createRootOwner, runWithOwner } from '../owners/owner.js';
import { PatchTarget } from '../../framework/patchTarget.js';

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
  const rootOwner = createRootOwner();
  rootOwner.context[SYNAPSE_CONTEXT_ID] = STATIC_RENDER_SYNAPSE;
  const [flattened, disposeFn] = runWithOwner(rootOwner, () => {
    const root = new ViewElementNode();
    const [dispose, owner] = render(root, renderFn, PatchTarget.None);
    return [flatten(root, owner), dispose];
  });

  disposeFn();
  return flattened as T[];
}
