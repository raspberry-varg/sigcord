import { Synapse } from './Synapse.js';

const QueuedUpdates = new Set<Synapse>();

export function queueUpdateMicrotask(synapse: Synapse): void {
  if (QueuedUpdates.has(synapse)) return;
  queueMicrotask(() => {
    synapse.doUpdate();
    QueuedUpdates.delete(synapse);
  });
  QueuedUpdates.add(synapse);
}
