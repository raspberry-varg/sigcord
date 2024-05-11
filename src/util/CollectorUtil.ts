export function endReasonIsTimeoutOrClose(endReason?: string | null) {
  return (
    endReason &&
    ['idle', 'timeout', 'time', 'close'].some((reason) => reason === endReason)
  );
}
