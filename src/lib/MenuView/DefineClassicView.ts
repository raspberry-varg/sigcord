import type { MaybePromise } from '../../util/TypesUtil.js';
import type { ClassViewDefinition } from '../FunctionalMenuView.js';
import type { IntrinsicMenuProps, MenuFactory } from '../InteractiveMenu.js';
import { MenuController } from '../MenuController.js';
import type { ViewMessagePayload } from '../MenuView.js';
import type { Synapse } from '../Synapse.js';
import type { PropsBase } from './ViewBase.js';

export interface ViewClassImplementation<Props extends PropsBase> {
  new (props: Props & { $: Synapse }): ViewClass<Props>;
}

export abstract class ViewClass<Props extends PropsBase = PropsBase> {
  constructor(protected readonly props: Props & { $: Synapse }) {}

  abstract render(
    props: Props & { $: Synapse },
  ): MaybePromise<ViewMessagePayload>;

  /** @deprecated It is recommended to use $.goTo instead. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-empty-function
  onSwap(..._args: unknown[]): MaybePromise<void> {}
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
    return MenuController(id, id, [definition], interaction, props);
  };
  return Object.assign(menuFactory, definition);
}
