import type { Context } from './context.js';
import { getOpenOwner, ownerLite } from '../owners/owner.js';
import { ContextNode } from './contextNode.js';

const ROOT_CONTEXT: Readonly<Context<void>> = {
  id: Symbol('ROOT_CONTEXT'),
  default: undefined,
};

export function provideRootContext<T>(callback: () => T): T {
  return provideContextValue(ROOT_CONTEXT, undefined, callback);
}

export function provideContextValue<T, U>(
  context: Readonly<Context<T>>,
  value: NoInfer<T>,
  callback: () => U,
): U {
  const openOwner = getOpenOwner();
  const contextNode = new ContextNode(openOwner?.context, context.id, value);

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
