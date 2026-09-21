import { getConfig } from '../../config.js';
import { isInternalContext } from '../../core/contexts/createInternalContext.js';
import { OwnerTraceContext } from '../../core/contexts/ownerTraceContext.js';
import { getOwner, type Owner } from '../owners/owner.js';

import { extractContext } from './useContext.js';

import type { Context } from './context.js';

export function provideContextValue<T>(context: Readonly<Context<T>>, value: NoInfer<T>): void {
  const openOwner = getOwner();
  if (openOwner) {
    setContextValueTo(openOwner, context, value);
  }
}

export function setContextValueTo<T>(
  owner: Owner,
  context: Readonly<Context<T>>,
  value: NoInfer<T>,
): void {
  owner.context[context.id] = value;
  if (getConfig().componentStacks && !isInternalContext(context)) {
    const traceNode = extractContext(owner, OwnerTraceContext);
    if (traceNode) {
      const providesString = `provides: ${context.id.description || context.id.toString()}`;
      traceNode.details = traceNode.details
        ? `${traceNode.details}, ${providesString}`
        : `${providesString}`;
    }
  }
}
