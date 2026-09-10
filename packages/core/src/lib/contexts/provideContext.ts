import type { Context } from './context.js';
import { getOpenOwner, ownerLite } from '../owners/owner.js';
import { ContextNode } from './contextNode.js';

export function provideContextValue<T, U>(
  context: Context<T>,
  value: NoInfer<T>,
  callback: () => U,
): U {
  const openOwner = getOpenOwner();
  const contextNode = new ContextNode(openOwner?.context, {
    [context.id]: value,
  });

  let result: U;
  ownerLite(
    () => {
      result = callback();
    },
    undefined,
    contextNode,
  );
  return result!;
}
