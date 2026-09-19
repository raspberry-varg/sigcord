import { type APIButtonComponentWithCustomId, ButtonBuilder } from "discord.js";

import {
  type Signal,
  component,
  createUniqueComponentId,
  effect,
  getCurrentSynapseOrDefault,
  isSignal,
  markDirty,
  useComponentHandler,
} from "@sigcord/core";

import { jsxLog } from "../internal/jsxLog.js";
import { JSX } from "../jsx-runtime.js";
import { upgradeStringSequenceToReactive } from "../util/upgradeStringSequenceToReactive.js";

import IntrinsicElements = JSX.IntrinsicElements;

export function createButton(
  props: IntrinsicElements["button"],
): ButtonBuilder {
  const id = props.id ?? createUniqueComponentId();

  const button = new ButtonBuilder().setCustomId(id);
  const onClick = props["on:click"];

  const legacy = !!getCurrentSynapseOrDefault();

  if (!legacy && onClick) {
    useComponentHandler(id, (interaction) => {
      if (interaction.isButton()) {
        return onClick(interaction);
      }
    });
  }

  let label: string | Signal<string> = "";
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
  if (typeof label === "string") {
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
  if (typeof style === "number") {
    button.setStyle(style);
  } else {
    (reactiveSetters ??= []).push(() => {
      button.setStyle(style());
    });
  }

  const disabled = props.disabled;
  if (disabled !== undefined) {
    if (typeof disabled === "boolean") {
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
    effect(() => {
      for (const setter of reactiveSetters) {
        try {
          setter();
        } catch (error: unknown) {
          jsxLog.error("Error processing reactive setter for button", error, {
            id,
            setter,
          });
        }
      }
      markDirty();
    });
  }

  if (onClick && legacy) {
    return component({
      id,
      component: button,
      handler: onClick,
    });
  } else {
    return button;
  }
}
