import { getOwnerOrThrow, type Owner } from '../owners/owner.js';

import type { Context } from './context.js';

/**
 * Attempt to inject a value from the current context.
 *
 * @param context
 */
export function useContext<T>(context: Context<T>): T {
  return extractContext(getOwnerOrThrow(), context);
}

/**
 * Extract the context of a given owner.
 */
export function extractContext<T>(targetOwner: Owner, context: Context<T>): T {
  const node = targetOwner.context;
  if (!node) {
    return context.default;
  }

  return context.id in node ? (node[context.id] as T) : context.default;
}

export function extractOwnContext<T>(targetOwner: Owner, context: Context<T>): T {
  const node = targetOwner.context;
  if (node.hasOwnProperty(context.id)) {
    return node[context.id] as T;
  }

  return context.default;
}
