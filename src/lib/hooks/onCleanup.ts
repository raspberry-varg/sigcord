import type { DisposeFn } from '../render/dispose.js';
import { getOpenOwnerStrict } from '../render/owner.js';

export function onCleanup(disposalFn: DisposeFn): void {
  const owner = getOpenOwnerStrict();
  owner.registerDisposal(disposalFn);
}
