import type { Context } from './context.js';
import { getOwner } from '../owners/owner.js';

export function provideContextValue<T>(
  context: Readonly<Context<T>>,
  value: NoInfer<T>,
): void {
  const openOwner = getOwner();
  if (openOwner) {
    openOwner.context[context.id] = value;
  }
}
