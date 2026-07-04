import {SeparatorBuilder} from 'discord.js';

import {patchEffect} from '@sigcord/core';

import type {IntrinsicElementProps} from '../index.js';

export function createSeparator(
  props: IntrinsicElementProps['separator'],
): SeparatorBuilder {
  const separator = new SeparatorBuilder();

  const spacing = props.spacing;
  if (spacing !== undefined) {
    if (typeof spacing === 'number') {
      separator.setSpacing(spacing);
    } else {
      patchEffect(() => {
        separator.setSpacing(spacing());
      });
    }
  }

  const divider = props.divider;
  if (divider !== undefined) {
    if (typeof divider === 'boolean') {
      separator.setDivider(divider);
    } else {
      patchEffect(() => {
        separator.setDivider(divider());
      });
    }
  }

  return separator;
}
