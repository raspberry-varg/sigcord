import {
  type MaybeSignal,
  component,
  getNextUniqueComponentId,
  read,
  getCurrentSynapseOrDefault,
  useComponentHandler,
  effect,
  markDirty,
} from '@sigcord/core';
import {
  ChannelSelectMenuBuilder,
  type ChannelSelectMenuInteraction,
  type ChannelType,
} from 'discord.js';

import { isNonNullable } from '../util/guards/isNonNullable.js';

import {
  type BaseSelectMenuProps,
  applyPatchEffect as applySelectMenuSignals,
} from './baseSelectMenuProps.js';

const MIN_DEFAULT = 0;
const MAX_DEFAULT = 1;

interface ChannelSelectMenuProps extends BaseSelectMenuProps<ChannelSelectMenuInteraction> {
  selected?: MaybeSignal<ReadonlyArray<MaybeSignal<string | null | undefined>>>;
  types?: MaybeSignal<ReadonlyArray<MaybeSignal<ChannelType | null | undefined>>>;
}

/**
 * Channel select menu that takes an optional list of pre-selected values and
 * the types of channels allowed.
 */
export function ChannelSelect(props: ChannelSelectMenuProps) {
  const id = props.id || getNextUniqueComponentId();

  let selectMenu = new ChannelSelectMenuBuilder().setCustomId(id);
  const legacy = getCurrentSynapseOrDefault();
  if (legacy) {
    selectMenu = component({
      id,
      component: selectMenu,
      handler: props['on:select'],
    });
  } else {
    useComponentHandler(id, (select) => {
      if (select.isChannelSelectMenu()) {
        return props['on:select'](select);
      }
    });
  }

  const selected = props.selected;
  if (selected) {
    effect(() => {
      const defaults = read(selected).map(read).filter(isNonNullable);
      selectMenu.setDefaultChannels(defaults);
      markDirty();
    });
  }

  const types = props.types;
  if (types) {
    effect(() => {
      const resolved = read(types).map(read).filter(isNonNullable);
      selectMenu.setChannelTypes(resolved);
      markDirty();
    });
  }

  applySelectMenuSignals(selectMenu, {
    min: () => read(props.min) ?? MIN_DEFAULT,
    max: () => read(props.max) ?? MAX_DEFAULT,
    placeholder: props.placeholder,
    disabled: props.disabled,
  });

  return selectMenu;
}
