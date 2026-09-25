export const TIMEOUT_END_REASONS = ['idle', 'timeout', 'time'] as const;

export function discordMessageComponentListenerEndIsTimeout(endReason?: string | null): boolean {
  return !!endReason && TIMEOUT_END_REASONS.some((reason) => reason === endReason);
}
