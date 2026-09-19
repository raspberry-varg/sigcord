import type { Context } from "../../lib/contexts/context.js";

export function createInternalContext<T>(
  id: string,
  defaultValue: T,
): Context<T>;
export function createInternalContext<T>(
  id: string,
  defaultValue?: undefined,
): Context<T | undefined>;
export function createInternalContext<T>(
  id: string,
  defaultValue?: T,
): Context<T | undefined> {
  return {
    id: Symbol.for(`__sigcord.${id}`),
    default: defaultValue,
  };
}
