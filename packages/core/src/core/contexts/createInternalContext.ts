import type { Context } from '../../lib/contexts/context.js';

const INTERNAL_CONTEXT_SYMBOL: unique symbol = Symbol('__sigcord.internalContext');
export interface InternalContext<T> extends Context<T> {
  [INTERNAL_CONTEXT_SYMBOL]: true;
}

export function createInternalContext<T>(id: string, defaultValue: T): Context<T>;
export function createInternalContext<T>(
  id: string,
  defaultValue?: undefined,
): Context<T | undefined>;
export function createInternalContext<T>(
  id: string,
  defaultValue?: T,
): InternalContext<T | undefined> {
  return {
    id: Symbol.for(`__sigcord.${id}`),
    default: defaultValue,
    [INTERNAL_CONTEXT_SYMBOL]: true,
  };
}

export function isInternalContext<T>(context: Context<T>): context is InternalContext<T> {
  return INTERNAL_CONTEXT_SYMBOL in context;
}
