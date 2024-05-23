export function assert(
  condition: any,
  msg?: string
): asserts condition is true {
  if (!condition) {
    throw new Error(msg);
  }
}

export function assertAndReturn<T>(
  value: T,
  condition: (condition: T) => boolean,
  msg?: string | ((value: T) => string)
): T {
  assert(condition(value), typeof msg === 'string' ? msg : msg?.(value));
  return value;
}
