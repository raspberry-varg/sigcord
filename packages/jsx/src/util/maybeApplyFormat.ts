export function maybeApplyFormat(
  formatter: (original: string) => string,
  str: string,
  appendNewline = false,
): string {
  if (!str) {
    return str;
  }
  if (!appendNewline) {
    return formatter(str);
  }
  return formatter(str) + '\n';
}
