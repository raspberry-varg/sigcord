import type { IntrinsicMenuProps, MenuFactory } from '../../menu/defineMenu.js';
import { instantiateMenu } from '../../menu/instance/menuInstance.js';
import { IS_V2 } from '../viewFlavors.js';
import type { PropsBase } from '../viewDefinitionBase.js';
import type {
  ReactiveViewDefinitionV1,
  ReactiveViewDefinitionV2,
} from './reactiveViewDefinition.js';
import type {
  ReactiveViewFactoryV1,
  ReactiveViewFactoryV2,
} from './reactiveViewFactory.js';
import { REACTIVE_VIEW_SYMBOL } from './reactiveViewSymbol.js';

/**
 * Define a reactive view instance.
 *
 * Returns a callable function to instantiate a new Menu instance.
 */

export function defineView<Props extends PropsBase = PropsBase>(
  id: string,
  factory: ReactiveViewFactoryV1<Props>,
  defaults: Partial<IntrinsicMenuProps> = {},
): ReactiveViewDefinitionV1<Props> & MenuFactory<Props> {
  const definition: ReactiveViewDefinitionV1<Props> = {
    id,
    factory,
    defaults,
    [REACTIVE_VIEW_SYMBOL]: true,
  };
  const menuFactory: MenuFactory<Props> = (interaction, props) => {
    return instantiateMenu(id, id, [definition], interaction, props);
  };
  return Object.assign(menuFactory, definition);
}

export function defineViewV2<Props extends PropsBase = PropsBase>(
  id: string,
  factory: ReactiveViewFactoryV2<Props>,
  defaults: Partial<IntrinsicMenuProps> = {},
): ReactiveViewDefinitionV2<Props> & MenuFactory<Props> {
  const definition: ReactiveViewDefinitionV2<Props> = {
    id,
    factory,
    defaults,
    [REACTIVE_VIEW_SYMBOL]: true,
    [IS_V2]: true,
  };
  const menuFactory: MenuFactory<Props> = (interaction, props) => {
    return instantiateMenu(id, id, [definition], interaction, props);
  };
  return Object.assign(menuFactory, definition);
}
