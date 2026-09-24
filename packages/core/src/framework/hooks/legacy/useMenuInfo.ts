import { coreLog } from '../../../internal/coreLog.js';
import { getCurrentSynapse } from '../../../lib/builtins/currentSynapse.js';
import { useCordInternal } from '../../cordContext.js';
import { useCurrentRepliable } from '../useCurrentRepliable.js';

import type { MenuContext } from '../../../lib/menu/instance/menuContext.js';

/**
 * @deprecated
 * Get info and state about the current menu.
 */
export function useMenuInfo(): Readonly<MenuContext> {
  const cord = useCordInternal();
  if (cord) {
    coreLog.warn('useMenuInfo() is deprecated, please rely on the useCurrentRepliable() hook.');
    const currentRepliable = useCurrentRepliable();
    const lastCollectedInteraction =
      currentRepliable && currentRepliable.isMessageComponent() ? currentRepliable : undefined;
    return {
      lastCollectedInteraction,
      menuId: '',
      idleTimeMs: 14_000,
      initialViewId: '',
      interaction: lastCollectedInteraction ?? currentRepliable!,
    };
  }
  coreLog.warn('useMenuInfo() is deprecated.');
  return getCurrentSynapse().getMenuInfo();
}
