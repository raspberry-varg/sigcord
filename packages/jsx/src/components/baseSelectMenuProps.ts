import type {
  APISelectMenuComponent,
  AnySelectMenuInteraction,
  BaseSelectMenuBuilder,
} from 'discord.js';

import {type MaybeSignal, type Signal, patchEffect, read} from '@sigcord/core';

export interface BaseSelectMenuProps<
  Interaction extends AnySelectMenuInteraction,
> {
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
  'on:select': (select: Interaction) => void;
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
  patchEffect(() => {
    selectMenu
      .setMinValues(props.min())
      .setMaxValues(props.max())
      .setPlaceholder(read(props.placeholder) ?? '')
      .setDisabled(!!read(props.disabled));
  });
}
