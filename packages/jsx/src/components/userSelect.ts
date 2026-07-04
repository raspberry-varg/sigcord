import {
  UserSelectMenuBuilder,
  type UserSelectMenuInteraction,
} from 'discord.js';

import {
  type MaybeSignal,
  component,
  getNextUniqueComponentId,
  patchEffect,
  read,
} from '@sigcord/core';

import {
  type BaseSelectMenuProps,
  applyPatchEffect as applySelectMenuSignals,
} from './baseSelectMenuProps.js';

const MIN_DEFAULT = 0;
const MAX_DEFAULT = 1;

interface UserSelectProps
  extends BaseSelectMenuProps<UserSelectMenuInteraction> {
  selected?: MaybeSignal<ReadonlyArray<MaybeSignal<string | null | undefined>>>;
}

/**
 * User select menu that takes an optional list of pre-selected values.
 */
export function UserSelect(props: UserSelectProps) {
  const id = props.id || getNextUniqueComponentId();

  const selectMenu = new UserSelectMenuBuilder();

  const selected = props.selected;
  if (selected) {
    patchEffect(() => {
      const defaults = read(selected)
        .map((s) => read(s))
        .filter((s): s is NonNullable<typeof s> => !!s);
      selectMenu.setDefaultUsers(defaults);
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
