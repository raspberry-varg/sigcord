import { type MaybeSignal, type Signal, effect, markDirty, read } from '@sigcord/core';

import type {
  APISelectMenuComponent,
  AnySelectMenuInteraction,
  BaseSelectMenuBuilder,
} from 'discord.js';

export interface BaseSelectMenuProps<Interaction extends AnySelectMenuInteraction> {
  id?: string;
  /**
   * The minimum required number of options the user must select.
   * @default 0
   */
  min?: MaybeSignal<number>;
  /**
   * The minimum required number of options the user can select.
   * @default 1
   */
  max?: MaybeSignal<number>;
  placeholder?: MaybeSignal<string>;
  disabled?: MaybeSignal<boolean>;
  onChange: (select: Interaction) => void;
  children?: unknown;
}

interface ApplyOptionsProps {
  min: Signal<number>;
  max: Signal<number>;
  placeholder: MaybeSignal<string | undefined>;
  disabled: MaybeSignal<boolean | undefined>;
}

export function applyPatchEffect(
  selectMenu: BaseSelectMenuBuilder<APISelectMenuComponent>,
  props: ApplyOptionsProps,
) {
  effect(() => {
    selectMenu
      .setMinValues(read(props.min))
      .setMaxValues(read(props.max))
      .setPlaceholder(read(props.placeholder) ?? '')
      .setDisabled(!!read(props.disabled));
    markDirty();
  });
}
