export type MaybePromise<T> = T | Promise<T>;
export type MaybeClosure<T> = T | (() => MaybePromise<T>);

export async function resolveMaybeFunction<T>(maybeFn: T) {
  while (typeof maybeFn === 'function') {
    maybeFn = await maybeFn();
  }
  // eslint-disable-next-line @typescript-eslint/ban-types
  return maybeFn as Exclude<T, Function>;
}
