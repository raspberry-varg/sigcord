import {StringSelectMenuOptionBuilder} from 'discord.js';

import {isSignal, patchEffect} from '@sigcord/core';

import type {IntrinsicElementProps} from '../index.js';

export function createStringSelectOption(
  props: IntrinsicElementProps['stringoption'],
): StringSelectMenuOptionBuilder {
  const option = new StringSelectMenuOptionBuilder();

  let reactiveSetters: CallableFunction[] | undefined;

  const label = props.label;
  if (!isSignal(label)) {
    option.setLabel(label);
  } else {
    (reactiveSetters ??= []).push(() => {
      option.setLabel(label());
    });
  }

  const value = props.value;
  if (!isSignal(value)) {
    option.setValue(value);
  } else {
    (reactiveSetters ??= []).push(() => {
      option.setValue(value());
    });
  }

  const description = props.description;
  if (description) {
    if (!isSignal(description)) {
      option.setDescription(description);
    } else {
      (reactiveSetters ??= []).push(() => {
        const d = description();
        if (d) {
          option.setDescription(d);
        } else {
          option.data.description = undefined;
        }
      });
    }
  }

  const emoji = props.emoji;
  if (emoji) {
    if (!isSignal(emoji)) {
      option.setEmoji(emoji);
    } else {
      (reactiveSetters ??= []).push(() => {
        const e = emoji();
        if (e) {
          option.setEmoji(e);
        } else {
          option.data.emoji = undefined;
        }
      });
    }
  }

  const selected = props.selected;
  if (selected !== undefined) {
    if (!isSignal(selected)) {
      option.setDefault(selected);
    } else {
      (reactiveSetters ??= []).push(() => {
        option.setDefault(selected());
      });
    }
  }

  if (reactiveSetters) {
    patchEffect(() => {
      for (const setter of reactiveSetters) {
        setter();
      }
    });
  }

  return option;
}
