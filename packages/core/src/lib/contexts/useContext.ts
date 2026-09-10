import { getOpenOwnerStrict } from '../owners/owner.js';
import type { Context } from './context.js';
import { CONTEXT_NOT_FOUND } from './contextNode.js';

/**
 * Attempt to inject a value from the current context.
 *
 * @param context
 */
export function useContext<T>(context: Context<T>): T | undefined {
  const openOwner = getOpenOwnerStrict();
  const node = openOwner.context;
  if (!node) {
    return undefined;
  }
  const result = node.get(context.id);
  return result !== CONTEXT_NOT_FOUND ? (result as T) : undefined;
}

/**
 * Inject a value from the current context, erroring if the value could not be
 * found.
 *
 * @param context
 * @throws Error
 */
export function useContextStrict<T>(context: Context<T>): T {
  const openOwner = getOpenOwnerStrict();
  const node = openOwner.context;
  if (!node) {
    throw new Error(
      `Unable to inject ${context.id.description}: There is no open context.`,
    );
  }
  const result = node.get(context.id);
  if (result === CONTEXT_NOT_FOUND) {
    throw new Error(
      `Unable to inject ${context.id.description}: No provider injects this id.`,
    );
  }
  return result as T;
}
