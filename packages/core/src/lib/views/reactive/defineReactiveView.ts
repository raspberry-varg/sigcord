import { MessageFlags, MessageFlagsBitField, type MessageFlagsResolvable } from 'discord.js';

import { getConfig } from '../../../config.js';
import { promiseWithResolvers } from '../../../core/utils/promiseWithResolvers.js';
import { MenuBuilder } from '../../../framework/menuBuilder.js';
import { instantiateMenu } from '../../menu/instance/instantiateMenu.js';
import { IS_V2 } from '../viewFlavors.js';

import { REACTIVE_VIEW_SYMBOL } from './reactiveViewSymbol.js';

import type { IntrinsicMenuProps, MenuFactory } from '../../menu/defineMenu.js';
import type { MenuInstanceActions } from '../../menu/instance/menuInstanceActions.js';
import type { PropsBase } from '../viewDefinitionBase.js';
import type {
  ReactiveViewDefinitionV1,
  ReactiveViewDefinitionV2,
} from './reactiveViewDefinition.js';
import type { ReactiveViewFactoryV1, ReactiveViewFactoryV2 } from './reactiveViewFactory.js';

/**
 * @deprecated Please use {@link MenuBuilder} with {@link MenuBuilder.mountV1} instead.
 *
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
    props = { ...defaults, ...props };
    if (!getConfig().useCordFactoriesForLegacyViewDefines) {
      return instantiateMenu(id, id, [definition], interaction, props);
    }
    throw new Error('defineViewV1 is not yet implemented.');
  };
  return Object.assign(menuFactory, definition);
}

/**
 * @deprecated Please use {@link MenuBuilder} with {@link MenuBuilder.mount} instead.
 *
 * Returns a callable function to instantiate a new Menu instance that supports Components V2.
 */
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
  const menuFactory: MenuFactory<Props> = (interaction, props): MenuInstanceActions => {
    const flags: MessageFlagsResolvable[] = [];
    if (defaults.flags != null) flags.push(defaults.flags);
    if (props.flags != null) flags.push(props.flags);
    if (defaults.ephemeral && props.ephemeral !== false) {
      flags.push(MessageFlags.Ephemeral);
    }
    if (props.ephemeral) {
      flags.push(MessageFlags.Ephemeral);
    }

    const resolvedFlags = MessageFlagsBitField.resolve(flags);
    const resolvedProps = { ...definition.defaults, ...props, flags: resolvedFlags };
    const isEphemeral = (resolvedFlags & MessageFlags.Ephemeral) !== 0;
    if (!getConfig().useCordFactoriesForLegacyViewDefines) {
      return instantiateMenu(id, id, [definition], interaction, resolvedProps);
    }
    const template = new MenuBuilder().ephemeral(isEphemeral);

    const endPromise = promiseWithResolvers<string | null>();
    const endCallbacks: Array<(reason: string | null) => void> = [endPromise.resolve];

    const timeoutPromise = promiseWithResolvers<void>();
    const timeoutCallbacks: Array<(reason: void) => void> = [timeoutPromise.resolve];

    return {
      async start(options) {
        if (options?.forceReply) {
          // TODO: Handle.
        }
        const result = await template.mount(interaction, () => definition.factory(resolvedProps));
        for (const cb of endCallbacks) {
          cb(result.reason === 'MANUAL_CLOSE' ? 'close' : result.reason);
        }
        if (result.reason === 'IDLE_TIMEOUT') {
          for (const cb of timeoutCallbacks) {
            cb();
          }
        }
      },
      onEnd(cb) {
        endCallbacks.push(cb);
      },
      awaitEnd() {
        return endPromise.promise;
      },
      onTimeout(cb) {
        timeoutCallbacks.push(cb);
      },
      awaitTimeout() {
        return timeoutPromise.promise;
      },
      async reply(options) {
        await this.start(options);
      },
    };
  };
  return Object.assign(menuFactory, definition);
}
