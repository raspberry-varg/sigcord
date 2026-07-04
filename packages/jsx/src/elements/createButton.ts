import {type APIButtonComponentWithCustomId, ButtonBuilder} from 'discord.js';

import {type Signal, component, isSignal, patchEffect} from '@sigcord/core';

import {JSX} from '../jsx-runtime.js';
import {upgradeStringSequenceToReactive} from '../util/upgradeStringSequenceToReactive.js';

import IntrinsicElements = JSX.IntrinsicElements;

export function createButton(
  props: IntrinsicElements['button'],
): ButtonBuilder {
  const button = new ButtonBuilder();
  if (props.id) {
    button.setCustomId(props.id);
  }

  let label: string | Signal<string> = '';
  if (props.children) {
    if (!Array.isArray(props.children)) {
      label = props.children;
    } else {
      const children = props.children;
      for (let i = 0; i < children.length; i++) {
        if (isSignal(children[i])) {
          label = upgradeStringSequenceToReactive(label, children, i);
          break;
        }
        label += children[i];
      }
    }
  }

  let reactiveSetters: CallableFunction[] | undefined = undefined;
  if (typeof label === 'string') {
    if (label) {
      button.setLabel(label);
    }
  } else {
    (reactiveSetters ??= []).push(() => {
      const l = label();
      if (l) {
        button.setLabel(l);
      } else {
        (button.data as APIButtonComponentWithCustomId).label = undefined;
      }
    });
  }

  const style = props.style;
  if (typeof style === 'number') {
    button.setStyle(style);
  } else {
    (reactiveSetters ??= []).push(() => {
      button.setStyle(style());
    });
  }

  const disabled = props.disabled;
  if (disabled !== undefined) {
    if (typeof disabled === 'boolean') {
      button.setDisabled(disabled);
    } else {
      (reactiveSetters ??= []).push(() => {
        button.setDisabled(disabled());
      });
    }
  }

  const emoji = props.emoji;
  if (emoji) {
    if (!isSignal(emoji)) {
      button.setEmoji(emoji);
    } else {
      (reactiveSetters ??= []).push(() => {
        const e = emoji();
        if (e) {
          button.setEmoji(e);
        } else {
          (button.data as APIButtonComponentWithCustomId).emoji = undefined;
        }
      });
    }
  }

  if (reactiveSetters) {
    patchEffect(() => {
      for (const setter of reactiveSetters) {
        try {
          setter();
        } catch (error: unknown) {
          console.error(error);
        }
      }
    });
  }

  if (!props['on:click']) {
    return button;
  }

  return component({
    id: props.id,
    component: button,
    handler: props['on:click'],
  });
}
