export function queueMicrotask<T>(task: () => T): Promise<T> {
  return Promise.resolve().then(task);
}
