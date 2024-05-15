export function endReasonIsTimeout(endReason?: string | null) {
  return (
    endReason &&
    ['idle', 'timeout', 'time'].some((reason) => reason === endReason)
  );
}
