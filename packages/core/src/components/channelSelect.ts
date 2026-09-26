import {
  APIChannelSelectComponent,
  APISelectMenuDefaultValue,
  ChannelSelectMenuBuilder,
  type ChannelSelectMenuInteraction,
  type ChannelType,
  ComponentType,
  SelectMenuDefaultValueType,
} from 'discord.js';

import {
  component,
  createUniqueComponentId,
  effect,
  markDirty,
  useComponentHandler,
} from '../framework/hooks/index.js';
import { getCurrentSynapseOrDefault } from '../lib/builtins/currentSynapse.js';
import { read } from '../lib/reactivity/core/read.js';

import { type BaseSelectMenuProps } from './baseSelectMenuProps.js';

import type { MaybeSignal } from '../lib/reactivity/core/signals.js';

const MIN_DEFAULT = 0;
const MAX_DEFAULT = 1;

const isNonNullable = <T>(value: T): value is NonNullable<T> => value != null;

interface ChannelSelectMenuProps extends BaseSelectMenuProps<ChannelSelectMenuInteraction> {
  selected?: MaybeSignal<ReadonlyArray<MaybeSignal<string | null | undefined>>>;
  types?: MaybeSignal<ReadonlyArray<MaybeSignal<ChannelType | null | undefined>>>;
}

/**
 * Channel select menu that takes an optional list of pre-selected values and
 * the types of channels allowed.
 */
export function ChannelSelect(props: ChannelSelectMenuProps) {
  const id = props.id || createUniqueComponentId();

  const selectMenu: APIChannelSelectComponent = {
    type: ComponentType.ChannelSelect,
    custom_id: id,
  };
  const legacy = getCurrentSynapseOrDefault();
  if (legacy) {
    component({
      id,
      component: new ChannelSelectMenuBuilder(),
      handler: props.onChange,
    });
  } else {
    useComponentHandler(id, (select) => {
      if (select.isChannelSelectMenu()) {
        return props.onChange(select);
      }
    });
  }

  const selected = props.selected;
  if (selected) {
    effect(() => {
      selectMenu.default_values = read(selected)
        .map(read)
        .filter(isNonNullable)
        .map((selectedId): APISelectMenuDefaultValue<SelectMenuDefaultValueType.Channel> => ({
          type: SelectMenuDefaultValueType.Channel,
          id: selectedId,
        }));
      markDirty();
    });
  }

  const types = props.types;
  if (types) {
    effect(() => {
      selectMenu.channel_types = read(types).map(read).filter(isNonNullable);
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

  return selectMenu;
}
