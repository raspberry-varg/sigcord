import { getOpenOwnerStrict } from '../owners/owner.js';
import type { Context } from './context.js';
import { CONTEXT_NOT_FOUND } from './contextNode.js';

/**
 * Attempt to inject a value from the current context.
 *
 * @param context
 */
export function useContext<T>(context: Context<T>): T {
  const openOwner = getOpenOwnerStrict();
  const node = openOwner.context;
  if (!node) {
    return context.default;
  }
  const result = node.get(context.id);
  return result !== CONTEXT_NOT_FOUND ? (result as T) : context.default;
}
