import { getOwnerOrThrow } from '../owners/owner.js';
import type { Context } from './context.js';

/**
 * Attempt to inject a value from the current context.
 *
 * @param context
 */
export function useContext<T>(context: Context<T>): T {
  const openOwner = getOwnerOrThrow();
  const node = openOwner.context;
  if (!node) {
    return context.default;
  }

  return context.id in node ? (node[context.id] as T) : context.default;
}
