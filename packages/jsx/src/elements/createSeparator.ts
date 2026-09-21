import { effect, markDirty } from '@sigcord/core';
import { SeparatorBuilder } from 'discord.js';

import type { IntrinsicElementProps } from '../index.js';

export function createSeparator(props: IntrinsicElementProps['separator']): SeparatorBuilder {
  const separator = new SeparatorBuilder();

  const spacing = props.spacing;
  if (spacing !== undefined) {
    if (typeof spacing === 'number') {
      separator.setSpacing(spacing);
    } else {
      effect(() => {
        separator.setSpacing(spacing());
        markDirty();
      });
    }
  }

  const divider = props.divider;
  if (divider !== undefined) {
    if (typeof divider === 'boolean') {
      separator.setDivider(divider);
    } else {
      effect(() => {
        separator.setDivider(divider());
        markDirty();
      });
    }
  }

  return separator;
}
