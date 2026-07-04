export function resolveString(s: unknown) {
  if (s === null || s === undefined) {
    return '';
  }
  return String(s);
}
