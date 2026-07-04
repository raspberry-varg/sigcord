import {
  ChannelSelectMenuBuilder,
  type ChannelSelectMenuInteraction,
  type ChannelType,
} from 'discord.js';

import {
  type MaybeSignal,
  component,
  getNextUniqueComponentId,
  patchEffect,
  read,
} from '@sigcord/core';

import {isNonNullable} from '../util/guards/isNonNullable.js';
import {
  type BaseSelectMenuProps,
  applyPatchEffect as applySelectMenuSignals,
} from './baseSelectMenuProps.js';

const MIN_DEFAULT = 0;
const MAX_DEFAULT = 1;

interface ChannelSelectMenuProps
  extends BaseSelectMenuProps<ChannelSelectMenuInteraction> {
  selected?: MaybeSignal<ReadonlyArray<MaybeSignal<string | null | undefined>>>;
  types?: MaybeSignal<
    ReadonlyArray<MaybeSignal<ChannelType | null | undefined>>
  >;
}

/**
 * Channel select menu that takes an optional list of pre-selected values and
 * the types of channels allowed.
 */
export function ChannelSelect(props: ChannelSelectMenuProps) {
  const id = props.id || getNextUniqueComponentId();

  const selectMenu = new ChannelSelectMenuBuilder();

  const selected = props.selected;
  if (selected) {
    patchEffect(() => {
      const defaults = read(selected).map(read).filter(isNonNullable);
      selectMenu.setDefaultChannels(defaults);
    });
  }

  const types = props.types;
  if (types) {
    patchEffect(() => {
      const resolved = read(types).map(read).filter(isNonNullable);
      selectMenu.setChannelTypes(resolved);
    });
  }

  applySelectMenuSignals(selectMenu, {
    min: () => read(props.min) ?? MIN_DEFAULT,
    max: () => read(props.max) ?? MAX_DEFAULT,
    placeholder: props.placeholder,
    disabled: props.disabled,
  });

  return component({
    id,
    component: selectMenu,
    handler: props['on:select'],
  });
}
