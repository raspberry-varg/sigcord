import { provideContextValue } from '../contexts/provideContext.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import { SynapseContext } from '../menu/instance/synapse.js';
import { createRootOwner, runWithOwner } from '../owners/owner.js';

import { flatten } from './flatten.js';
import { renderFragment } from './render.js';
import { STATIC_RENDER_SYNAPSE } from './staticRenderSynapse.js';

import type { ViewNodeKind, ViewNodeKindBase } from '../dom/viewNodeKind.js';

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
  const nodes = runWithOwner(rootOwner, () => {
    provideContextValue(SynapseContext, STATIC_RENDER_SYNAPSE);
    return renderFragment(renderFn);
  });

  const root = new ViewElementNode();
  root.setChildren(...nodes);
  const flattened = flatten(root, rootOwner);

  rootOwner.dispose();
  return flattened as T[];
}
