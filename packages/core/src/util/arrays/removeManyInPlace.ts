export function removeManyInPlace<T>(
  array: T[],
  toRemove: ReadonlySet<T>,
): void {
  let writeSlot = 0;
  for (let i = 0; i < array.length; i++) {
    const item = array[i];
    if (!toRemove.has(item)) {
      array[writeSlot++] = item;
    }
  }
  array.length = writeSlot;
}
