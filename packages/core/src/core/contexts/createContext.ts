import { provideContextValue } from '../../lib/contexts/provideContext.js';
import { getOwnerOrThrow, owner } from '../../lib/owners/owner.js';
import { createBoundaryNode, type ViewNode } from '../../lib/vdom/index.js';

import type { Context } from '../../lib/contexts/context.js';

/**
 * Props for a Context's {@link Provider} component.
 */
export interface ProviderProps<T> {
  value: T;
  children: unknown;
}

interface CreateContextOptions {
  name?: string;
}

/**
 * Creates a new context with a built-in Provider component.
 */
export interface ContextWithProvider<T> extends Context<T> {
  Provider: (props: ProviderProps<T>) => ViewNode | ViewNode[];
}

/**
 * Creates a new context with a Provider component.
 */
export function createContext<T>(
  defaultValue?: undefined,
  options?: CreateContextOptions,
): ContextWithProvider<T | undefined>;
export function createContext<T>(
  defaultValue: T,
  options?: CreateContextOptions,
): ContextWithProvider<T>;
export function createContext<T>(
  defaultValue?: T,
  options?: CreateContextOptions,
): ContextWithProvider<T | undefined> {
  const context: ContextWithProvider<T | undefined> = {
    id: Symbol(options?.name ?? 'unnamed context'),
    default: defaultValue,
    Provider: (props: ProviderProps<T | undefined>) => {
      return owner(() => {
        provideContextValue(context, props.value);
        return createBoundaryNode(
          getOwnerOrThrow(),
          Array.isArray(props.children) ? props.children : [props.children],
        );
      });
    },
  };
  return context;
}
