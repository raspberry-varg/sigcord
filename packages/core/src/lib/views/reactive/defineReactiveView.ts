import {
  MessageFlags,
  MessageFlagsBitField,
  type MessageFlagsResolvable,
  type RepliableInteraction,
} from 'discord.js';

import { getConfig } from '../../../config.js';
import { promiseWithResolvers } from '../../../core/utils/promiseWithResolvers.js';
import { composeCord } from '../../../framework/cordComposer.js';
import { instantiateMenu } from '../../menu/instance/instantiateMenu.js';
import { IS_V2 } from '../viewFlavors.js';

import { REACTIVE_VIEW_SYMBOL } from './reactiveViewSymbol.js';

import type { V1Payload } from '../../../framework/strands/componentsV1Strand.js';
import type { IntrinsicMenuProps, MenuFactory } from '../../menu/defineMenu.js';
import type { MenuInstanceActions } from '../../menu/instance/menuInstanceActions.js';
import type { PropsBase } from '../viewDefinitionBase.js';
import type {
  ReactiveViewDefinitionV1,
  ReactiveViewDefinitionV2,
} from './reactiveViewDefinition.js';
import type {
  ReactiveViewFactory,
  ReactiveViewFactoryV1,
  ReactiveViewFactoryV2,
} from './reactiveViewFactory.js';

/**
 * @deprecated Please use {@link CordComposer} with {@link CordComposer.mountV1} instead.
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
    return toMenuInstanceActions('v1', definition.factory, isEphemeral, interaction, resolvedProps);
  };
  return Object.assign(menuFactory, definition);
}

/**
 * @deprecated Please use {@link CordComposer} with {@link CordComposer.mount} instead.
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
  const menuFactory: MenuFactory<Props> = (
    interaction,
    props = {} as Props,
  ): MenuInstanceActions => {
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
    return toMenuInstanceActions('v2', definition.factory, isEphemeral, interaction, resolvedProps);
  };
  return Object.assign(menuFactory, definition);
}

function toMenuInstanceActions(
  mountPath: 'v1',
  factory: ReactiveViewFactoryV1<any>,
  isEphemeral: boolean,
  interaction: RepliableInteraction,
  resolvedProps: PropsBase,
): MenuInstanceActions;
function toMenuInstanceActions(
  mountPath: 'v2',
  factory: ReactiveViewFactoryV2<any>,
  isEphemeral: boolean,
  interaction: RepliableInteraction,
  resolvedProps: PropsBase,
): MenuInstanceActions;
function toMenuInstanceActions(
  mountPath: 'v1' | 'v2',
  factory: ReactiveViewFactory<any>,
  isEphemeral: boolean,
  interaction: RepliableInteraction,
  resolvedProps: PropsBase,
): MenuInstanceActions {
  const template = composeCord().ephemeral(isEphemeral);

  const endPromise = promiseWithResolvers<string | null>();
  const endCallbacks: Array<(reason: string | null) => void> = [endPromise.resolve];

  const timeoutPromise = promiseWithResolvers<void>();
  const timeoutCallbacks: Array<(reason: void) => void> = [timeoutPromise.resolve];
  return {
    async start(options) {
      if (options?.forceReply) {
        // TODO: Handle.
      }
      const result =
        mountPath === 'v1'
          ? await template.mountV1(interaction, () => factory(resolvedProps) as V1Payload)
          : await template.mount(interaction, () => factory(resolvedProps));
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
}
