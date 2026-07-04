import type { MaybePromise } from '../../../util/TypesUtil.js';
import type { ClassViewDefinition } from '../../FunctionalMenuView.js';
import type { IntrinsicMenuProps, MenuFactory } from '../../menu/defineMenu.js';
import type { ViewMessagePayload } from '../viewFlavors.js';
import type { Synapse } from '../../menu/instance/synapse.js';
import type { PropsBase } from '../viewDefinitionBase.js';
import { instantiateMenu } from '../../menu/instance/instantiateMenu.js';

export interface ViewClassImplementation<Props extends PropsBase> {
  new (props: Props & { $: Synapse }): ViewClass<Props>;
}

export abstract class ViewClass<Props extends PropsBase = PropsBase> {
  constructor(protected readonly props: Props & { $: Synapse }) {}

  abstract render(
    props: Props & { $: Synapse },
  ): MaybePromise<ViewMessagePayload>;

  /**
   * Action to perform when this view is swapped back into via id with $.swap().
   *
   * It is more preferable if $.goTo() is used instead as it provides the most
   * type safety and doesn't require registration of views in advance.
   *
   * @param _args Args passed through the call to $.swap.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onSwap(..._args: unknown[]): void {}
}

export function defineClassView<Props extends PropsBase>(
  id: string,
  implementation: {
    new (props: Props & { $: Synapse }): ViewClass<Props>;
  },
  defaults: Partial<IntrinsicMenuProps> = {},
): ClassViewDefinition<Props> & MenuFactory<Props> {
  const definition: ClassViewDefinition<Props> = {
    id,
    defaults,
    class: implementation,
  };
  const menuFactory: MenuFactory<Props> = (interaction, props) => {
    return instantiateMenu(id, id, [definition], interaction, props);
  };
  return Object.assign(menuFactory, definition);
}
