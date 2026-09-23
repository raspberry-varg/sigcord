import {
  type Context as CoreContext,
  getOwnerOrThrow,
  owner,
  provideContextValue,
  createOwnerBoundary,
} from '@sigcord/core';

import type { JSXChildren } from '../jsx-runtime.js';

interface ProviderProps<T> extends Required<JSXChildren> {
  value: T;
}

/**
 * Context with a Provider.
 */
export interface Context<T> extends CoreContext<T> {
  Provider: (props: ProviderProps<T>) => (typeof props)['children'];
}

interface CreateContextOptions {
  name?: string;
}

/**
 * Creates a new context with a Provider component.
 */
export function createContext<T>(
  defaultValue?: undefined,
  options?: CreateContextOptions,
): Context<T | undefined>;
export function createContext<T>(defaultValue: T, options?: CreateContextOptions): Context<T>;
export function createContext<T>(
  defaultValue?: T,
  options?: CreateContextOptions,
): Context<T | undefined> {
  const context: Context<T | undefined> = {
    id: Symbol(options?.name ?? 'unnamed context'),
    default: defaultValue,
    Provider: (props: ProviderProps<T | undefined>) => {
      return owner(() => {
        provideContextValue(context, props.value);
        return createOwnerBoundary(
          getOwnerOrThrow(),
          Array.isArray(props.children) ? props.children : [props.children],
        );
      });
    },
  };
  return context;
}
