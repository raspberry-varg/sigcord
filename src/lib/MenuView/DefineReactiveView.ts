import type { IntrinsicMenuProps, MenuFactory } from '../InteractiveMenu.js';
import { MenuController } from '../MenuController.js';
import {
  IS_REACTIVE_SYMBOL,
  type ReactiveViewDefinition,
  type ReactiveViewFactory,
} from './ReactiveView.js';
import type { PropsBase } from './ViewBase.js';

/**
 * Define a reactive view instance.
 *
 * Returns a callable function to instantiate a new Menu instance.
 */
export function defineView<Props extends PropsBase = PropsBase>(
  id: string,
  factory: ReactiveViewFactory<Props>,
  defaults: Partial<IntrinsicMenuProps> = {},
): ReactiveViewDefinition<Props> & MenuFactory<Props> {
  const definition: ReactiveViewDefinition<Props> = {
    id,
    factory,
    defaults,
    [IS_REACTIVE_SYMBOL]: true,
  };
  const menuFactory: MenuFactory<Props> = (interaction, props) => {
    return MenuController(id, id, [definition], interaction, props);
  };
  return Object.assign(menuFactory, definition);
}
