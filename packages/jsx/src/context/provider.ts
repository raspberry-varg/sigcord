import {
  type Context as CoreContext,
  flattenToContentNodes,
  provideContextValue,
} from '@sigcord/core';

import type {JSXChildren} from '../jsx-runtime.js';

interface ProviderProps<T> extends Required<JSXChildren> {
  value: T;
}

/**
 * Context with a Provider.
 */
export interface Context<T> extends CoreContext<T> {
  Provider: (props: ProviderProps<T>) => (typeof props)['children'];
}

interface CreateContextOptions<T> {
  name?: string;
  default?: T;
}

/**
 * Creates a new context with a Provider component.
 */
export function createContext<T>(
  options?: CreateContextOptions<T>,
): Context<T> {
  const context: Context<T> = {
    id: Symbol(options?.name ?? 'unnamed context'),
    default: options?.default,
    Provider: (props) =>
      provideContextValue(context, props.value, () =>
        flattenToContentNodes(props.children),
      ),
  };
  return context;
}
