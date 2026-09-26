import {
  type BoundaryNode,
  type Context,
  createBoundaryNode,
  createOwner,
  getOwner,
  setContextValueTo,
} from '@sigcord/core';

type ContextEntry<T> = readonly [Context<T>, NoInfer<T>];

/**
 * Provide multiple context entries under a single owner.
 *
 * Avoid the nested <FooContext.Provider> tree of doom.
 */
function Provide<T extends Iterable<ContextEntry<unknown>>>({
  contexts,
  children,
}: {
  contexts: T;
  children: unknown;
}): BoundaryNode {
  const provideOwner = createOwner(getOwner());
  for (const [context, value] of contexts) {
    setContextValueTo(provideOwner, context, value);
  }

  return createBoundaryNode(provideOwner, Array.isArray(children) ? children : [children]);
}

/**
 * Type-safe wrapper to create a context entry for {@link Provide}.
 */
Provide.entry = <T>(context: Context<T>, value: NoInfer<T>): ContextEntry<T> => [context, value];

export { Provide };
