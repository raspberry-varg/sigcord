export const TIMEOUT_END_REASONS = ['idle', 'timeout', 'time'] as const;
export type TimeoutEndReason = (typeof TIMEOUT_END_REASONS)[number];

export function endReasonIsTimeout(
  endReason?: string | null,
): endReason is TimeoutEndReason {
  return (
    !!endReason && TIMEOUT_END_REASONS.some((reason) => reason === endReason)
  );
}
