import type { PropsBase } from '../../views/viewDefinitionBase.js';
import { View } from '../../views/view.js';
import type { RepliableInteraction } from 'discord.js';
import type { MenuInstanceActions } from './menuInstanceActions.js';
import { MenuInstance } from './menuInstance.js';

export function instantiateMenu<
  ViewId extends string = string,
  AllProps extends PropsBase = PropsBase,
>(
  menuId: string,
  initialViewId: string,
  registeredViews: View<AllProps>[],
  interaction: RepliableInteraction,
  initProps: NonNullable<unknown>,
): MenuInstanceActions {
  return new MenuInstance<ViewId, AllProps>(
    menuId,
    initialViewId,
    interaction,
    initProps,
    registeredViews,
  );
}
