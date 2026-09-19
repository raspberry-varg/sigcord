import { getOwnerOrThrow } from "../../lib/owners/owner.js";
import type { ResumeFn, SuspendFn } from "../../lib/render/dispose.js";

/**
 * Perform an action when this reactive view is navigated away from.
 *
 * @param action Action to perform when this view suspends.
 */
export function onSuspend(action: SuspendFn): void {
  getOwnerOrThrow().registerOnSuspend(action);
}

/**
 * Perform an action when this reactive view is navigated back to.
 *
 * @param action Action to perform when this menu is navigated back to.
 */
export function onResume(action: ResumeFn): void {
  getOwnerOrThrow().registerOnResume(action);
}
/**
 * Check if the current reactive view is suspended.
 *
 * @description
 * Views are marked as suspended when they are navigated away from with
 * {@link goTo()}.
 */
export function isSuspended(): boolean {
  return getOwnerOrThrow().suspended;
}
