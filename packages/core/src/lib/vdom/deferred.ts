// oxlint-disable no-underscore-dangle

import { getConfig } from '../../config.js';
import { OwnerTraceContext, OwnerTraceType } from '../../core/contexts/ownerTraceContext.js';
import { enhanceErrorWithComponentStack } from '../../core/utils/errorStack.js';
import { coreLog } from '../../internal/coreLog.js';
import { provideContextValue } from '../contexts/provideContext.js';
import { useContext } from '../contexts/useContext.js';
import { createOwner, getOwner, runWithOwner } from '../owners/owner.js';
import { type DeferredComponentLegacy } from '../render/deferredComponent.js';
import { flattenToContentNodes } from '../render/flattenToContentNodes.js';

import { type DeferredNode, NodeType } from './types.js';
import { ViewNodeLegacy } from './viewNodeLegacy.js';

export class DeferredComponentViewNodeLegacy extends ViewNodeLegacy {
  private content?: ViewNodeLegacy[];

  constructor(readonly deferredComponent: DeferredComponentLegacy<any>) {
    super();
  }

  execute() {
    if (!this.content) {
      this.content = flattenToContentNodes(this.deferredComponent.execute()) as any;
    }
    return this.content;
  }

  dispose(): void {
    if (this.content) {
      for (let i = 0; i < this.content.length; i++) {
        this.content[i].dispose();
      }
      this.content = undefined;
    }
  }
}

export function createDeferredNode(
  componentFn: DeferredNode['componentFn'],
  props: DeferredNode['props'],
): DeferredNode {
  return {
    $$typeof: NodeType.Deferred,
    componentFn,
    props,
    capturedOwner: getOwner(),
    _resolvedContent: undefined,
  };
}

export function executeDeferredNode(node: DeferredNode): unknown {
  if (node._resolvedContent != null) {
    return node._resolvedContent;
  }

  if (!getConfig().componentStacks) {
    node._resolvedContent = node.componentFn(node.props ?? {});
    return node._resolvedContent;
  }

  const componentOwner = createOwner(node.capturedOwner);
  node._resolvedContent = runWithOwner(componentOwner, () => {
    provideContextValue(OwnerTraceContext, {
      type: OwnerTraceType.Component,
      name: node.componentFn.name || 'AnonymousComponent',
    });
    try {
      console.log(
        `>>> Executing ${node.componentFn.name} with the context value`,
        useContext(OwnerTraceContext),
      );
      return node.componentFn(node.props ?? {});
    } catch (e: unknown) {
      coreLog.error('Error occurred while executing deferred component, enhancing error stack', e);
      throw enhanceErrorWithComponentStack(e, componentOwner);
    } finally {
      console.log('>> DONE, exiting');
    }
  });
}
