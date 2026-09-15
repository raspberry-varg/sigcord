import type { DisposeFn } from '../render/dispose.js';
import { getOwnerOrThrow } from '../owners/owner.js';

export function onCleanup(disposalFn: DisposeFn): void {
  const owner = getOwnerOrThrow();
  owner.registerDisposal(disposalFn);
}
