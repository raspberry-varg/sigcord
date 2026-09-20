import { getCurrentSynapse } from '../../../lib/builtins/currentSynapse.js';

import type { MenuContext } from '../../../lib/menu/instance/menuContext.js';

/**
 * @deprecated
 * Get info and state about the current menu.
 */
export function useMenuInfo(): Readonly<MenuContext> {
  return getCurrentSynapse().getMenuInfo();
}
