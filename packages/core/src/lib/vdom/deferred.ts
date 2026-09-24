// oxlint-disable no-underscore-dangle

import { getConfig } from '../../config.js';
import { OwnerTraceContext, OwnerTraceType } from '../../core/contexts/ownerTraceContext.js';
import { enhanceErrorWithComponentStack } from '../../core/utils/errorStack.js';
import { coreLog } from '../../internal/coreLog.js';
import { provideContextValue } from '../contexts/provideContext.js';
import { createOwner, getOwner, runWithOwner } from '../owners/owner.js';

import { type DeferredNode, NodeType } from './types.js';

export function createDeferredNode(
  componentFn: DeferredNode['componentFn'],
  props: DeferredNode['props'],
): DeferredNode {
  return {
    $$typeof: NodeType.Deferred,
    componentFn,
    props,
    _owner: null,
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

  const componentOwner = (node._owner ??= createOwner(getOwner()));
  node._resolvedContent = runWithOwner(componentOwner, () => {
    provideContextValue(OwnerTraceContext, {
      type: OwnerTraceType.Component,
      name: node.componentFn.name || 'AnonymousComponent',
    });
    try {
      return node.componentFn(node.props ?? {});
    } catch (e: unknown) {
      coreLog.error('Error occurred while executing deferred component, enhancing error stack');
      throw enhanceErrorWithComponentStack(e, componentOwner);
    }
  });
  return node._resolvedContent;
}
