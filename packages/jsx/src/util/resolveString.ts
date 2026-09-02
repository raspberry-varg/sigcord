export function resolveString(s: unknown) {
  if (s == null || s === false) {
    return '';
  }
  return String(s);
}
