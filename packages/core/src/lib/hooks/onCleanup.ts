import { getOwnerOrThrow } from "../owners/owner.js";
import type { DisposeFn } from "../render/dispose.js";

export function onCleanup(disposalFn: DisposeFn): void {
  const owner = getOwnerOrThrow();
  owner.registerDisposal(disposalFn);
}
