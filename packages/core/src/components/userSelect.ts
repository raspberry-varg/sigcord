import {
  APISelectMenuDefaultValue,
  type APIUserSelectComponent,
  ComponentType,
  SelectMenuDefaultValueType,
  UserSelectMenuBuilder,
  type UserSelectMenuInteraction,
} from 'discord.js';

import { component, effect, markDirty, useComponentHandler } from '../framework/hooks/index.js';
import { getNextUniqueComponentId } from '../lib/builtins/builtins.js';
import { getCurrentSynapseOrDefault } from '../lib/builtins/currentSynapse.js';
import { read } from '../lib/reactivity/core/read.js';

import { type BaseSelectMenuProps } from './baseSelectMenuProps.js';

import type { MaybeSignal } from '../lib/reactivity/core/signals.js';

const MIN_DEFAULT = 0;
const MAX_DEFAULT = 1;

interface UserSelectProps extends BaseSelectMenuProps<UserSelectMenuInteraction> {
  selected?: MaybeSignal<ReadonlyArray<MaybeSignal<string | null | undefined>>>;
}

/**
 * User select menu that takes an optional list of pre-selected values.
 */
export function UserSelect(props: UserSelectProps) {
  const id = props.id || getNextUniqueComponentId();

  const selectMenu: APIUserSelectComponent = {
    type: ComponentType.UserSelect,
    custom_id: id,
  };

  const selected = props.selected;
  if (selected) {
    effect(() => {
      selectMenu.default_values = read(selected)
        .map((selectedId) => read(selectedId))
        .filter((selectedId): selectedId is NonNullable<typeof selectedId> => !!selectedId)
        .map((selectedId): APISelectMenuDefaultValue<SelectMenuDefaultValueType.User> => ({
          type: SelectMenuDefaultValueType.User,
          id: selectedId,
        }));
      markDirty();
    });
  }

  effect(() => {
    selectMenu.min_values = read(props.min) ?? MIN_DEFAULT;
    selectMenu.max_values = read(props.max) ?? MAX_DEFAULT;
    selectMenu.placeholder = read(props.placeholder);
    selectMenu.disabled = read(props.disabled);
    markDirty();
  });

  const legacy = getCurrentSynapseOrDefault();
  if (legacy) {
    component({
      id,
      component: new UserSelectMenuBuilder(),
      handler: props.onChange,
    });
  } else {
    useComponentHandler(id, (collectedInteraction) => {
      if (collectedInteraction.isUserSelectMenu()) {
        return props.onChange;
      }
    });
  }

  return selectMenu;
}
