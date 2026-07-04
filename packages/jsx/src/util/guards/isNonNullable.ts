export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== undefined && value !== null;
}
