import { logger } from '../util/Logger.js';
import { createUntracked, type Signal } from './Reactivity.js';
import { Synapse } from './Synapse.js';

const QueuedUpdates = new Set<Synapse>();

export function queueUpdateMicrotask(
  synapse: Synapse,
  isActiveView: Signal<boolean>,
): void {
  if (QueuedUpdates.has(synapse)) return;
  queueMicrotask(() => {
    if (!createUntracked(isActiveView))
      return logger.debug('MICROTASK :: not active view, not updating.');
    synapse.doUpdate();
    QueuedUpdates.delete(synapse);
  });
  QueuedUpdates.add(synapse);
}
