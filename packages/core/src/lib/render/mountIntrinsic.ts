import {
  type APIActionRowComponent,
  type APIButtonComponentWithCustomId,
  type APIComponentInActionRow,
  type APIContainerComponent,
  type APISectionComponent,
  type APISelectMenuOption,
  type APISeparatorComponent,
  type APIStringSelectComponent,
  type APITextDisplayComponent,
  ButtonBuilder,
  ComponentType,
  parseEmoji,
  StringSelectMenuBuilder,
} from 'discord.js';

import { computed } from '../../core/primitives/index.js';
import {
  component,
  createUniqueComponentId,
  effect,
  markDirty,
  useComponentHandler,
} from '../../framework/hooks/index.js';
import { coreLog } from '../../internal/coreLog.js';
import { getCurrentSynapseOrDefault } from '../builtins/currentSynapse.js';
import { read } from '../reactivity/core/read.js';
import { isSignal } from '../reactivity/core/signals.js';

import type { IntrinsicPropsMap } from '../vdom/index.js';

const STRING_SELECT_MIN_DEFAULT = 0;
const STRING_SELECT_MAX_DEFAULT = 1;

export function mountIntrinsic(
  type: keyof IntrinsicPropsMap,
  props: IntrinsicPropsMap[keyof IntrinsicPropsMap],
): unknown {
  switch (type) {
    case 'separator': {
      cast<'separator'>(props);
      const separator: APISeparatorComponent = {
        type: ComponentType.Separator,
      };

      const spacing = props.spacing;
      if (spacing !== undefined) {
        if (typeof spacing === 'number') {
          separator.spacing = spacing;
        } else {
          effect(() => {
            separator.spacing = spacing();
            markDirty();
          });
        }
      }

      const divider = props.divider;
      if (divider !== undefined) {
        if (typeof divider === 'boolean') {
          separator.divider = divider;
        } else {
          effect(() => {
            separator.divider = divider();
            markDirty();
          });
        }
      }

      return separator;
    }
    case 'text': {
      cast<'text'>(props);
      return {
        type: ComponentType.TextDisplay,
        content: '',
      } satisfies APITextDisplayComponent;
    }
    case 'container': {
      cast<'container'>(props);
      const container: Partial<APIContainerComponent> = {
        type: ComponentType.Container,
      };
      if (props.accent !== undefined) {
        if (isSignal(props.accent) || typeof props.accent === 'function') {
          effect(() => {
            const color = read(props.accent);
            container.accent_color = color === true ? 1 : color || undefined;
            markDirty();
          });
        } else {
          container.accent_color = props.accent === true ? 1 : props.accent || undefined;
        }
      }

      // Spoiler
      if (props.spoiler !== undefined) {
        if (isSignal(props.spoiler) || typeof props.spoiler === 'function') {
          effect(() => {
            container.spoiler = read(props.spoiler);
            markDirty();
          });
        } else {
          container.spoiler = props.spoiler;
        }
      }

      return container;
    }
    case 'section':
      cast<'section'>(props);
      return {
        type: ComponentType.Section,
        components: [],
      } satisfies Partial<APISectionComponent>;
    case 'actionRow': {
      cast<'actionRow'>(props);
      return {
        type: ComponentType.ActionRow,
        components: [],
      } satisfies APIActionRowComponent<APIComponentInActionRow>;
    }
    case 'stringOption': {
      cast<'stringOption'>(props);
      const option: Partial<APISelectMenuOption> = {};

      let reactiveSetters: CallableFunction[] | undefined;

      const label = props.label;
      if (!isSignal(label)) {
        option.label = label;
      } else {
        (reactiveSetters ??= []).push(() => {
          option.label = label();
        });
      }

      const value = props.value;
      if (!isSignal(value)) {
        option.value = String(value);
      } else {
        (reactiveSetters ??= []).push(() => {
          option.value = String(value());
        });
      }

      const description = props.description;
      if (description) {
        if (!isSignal(description)) {
          option.description = description;
        } else {
          (reactiveSetters ??= []).push(() => {
            option.description = description() || undefined;
          });
        }
      }

      const emoji = props.emoji;
      if (emoji) {
        if (!isSignal(emoji)) {
          option.emoji = (typeof emoji === 'string' ? parseEmoji(emoji) : emoji) ?? undefined;
        } else {
          (reactiveSetters ??= []).push(() => {
            const emojiValue = emoji();
            option.emoji =
              (typeof emojiValue === 'string' ? parseEmoji(emojiValue) : emojiValue) ?? undefined;
          });
        }
      }

      const selected = props.selected;
      if (selected !== undefined) {
        if (!isSignal(selected)) {
          option.default = selected;
        } else {
          (reactiveSetters ??= []).push(() => {
            option.default = selected();
          });
        }
      }

      if (reactiveSetters) {
        effect(() => {
          for (const setter of reactiveSetters) {
            setter();
          }
          markDirty();
        });
      }

      return option;
    }
    case 'button': {
      cast<'button'>(props);
      const id = props.id ?? createUniqueComponentId();

      const button: Partial<APIButtonComponentWithCustomId> = {
        type: ComponentType.Button,
        custom_id: id,
      };

      const onClick = props.onClick;

      const legacy = !!getCurrentSynapseOrDefault();

      if (!legacy && onClick) {
        useComponentHandler(id, (interaction) => {
          if (interaction.isButton()) {
            return onClick(interaction);
          }
        });
      }

      let reactiveSetters: CallableFunction[] | undefined = undefined;

      const style = props.style;
      if (typeof style === 'number') {
        button.style = style;
      } else {
        (reactiveSetters ??= []).push(() => {
          button.style = style();
        });
      }

      const disabled = props.disabled;
      if (disabled !== undefined) {
        if (typeof disabled === 'boolean') {
          button.disabled = disabled;
        } else {
          (reactiveSetters ??= []).push(() => {
            button.disabled = disabled();
          });
        }
      }

      const emoji = props.emoji;
      if (emoji) {
        if (!isSignal(emoji)) {
          button.emoji = (typeof emoji === 'string' ? parseEmoji(emoji) : emoji) ?? undefined;
        } else {
          (reactiveSetters ??= []).push(() => {
            const emojiValue = emoji();
            button.emoji =
              (typeof emojiValue === 'string' ? parseEmoji(emojiValue) : emojiValue) ?? undefined;
          });
        }
      }

      if (reactiveSetters) {
        effect(() => {
          for (const setter of reactiveSetters) {
            try {
              setter();
            } catch (error: unknown) {
              coreLog.error('Error processing reactive setter for button', error, {
                id,
                setter,
              });
            }
          }
          markDirty();
        });
      }

      if (onClick && legacy) {
        component({
          id,
          component: new ButtonBuilder(button),
          handler: onClick,
        });
      }
      return button;
    }
    case 'stringSelect': {
      cast<'stringSelect'>(props);
      const id = props.id || createUniqueComponentId();

      const stringSelect: Partial<APIStringSelectComponent> = {
        type: ComponentType.StringSelect,
        custom_id: id,
      };

      const legacy = getCurrentSynapseOrDefault();
      if (legacy) {
        component({
          id,
          component: new StringSelectMenuBuilder(),
          handler: props.onChange,
        });
      } else {
        useComponentHandler(id, (select) => {
          if (select.isStringSelectMenu()) {
            return props.onChange(select);
          }
        });
      }

      const min = computed(() => {
        const m = read(props.min) ?? STRING_SELECT_MIN_DEFAULT;
        return Math.max(0, m);
      });
      const max = computed(() => {
        return read(props.max) ?? STRING_SELECT_MAX_DEFAULT;
      });
      effect(() => {
        stringSelect.placeholder = read(props.placeholder);

        // Adjusted in updateIntrinsicChildren
        stringSelect.min_values = min();
        stringSelect.max_values = max();
        stringSelect.disabled = !!read(props.disabled);
        markDirty();
      });

      return stringSelect;
    }
    case 'a':
    case 'b':
    case 'br':
    case 'code':
    case 'channel':
    case 'h1':
    case 'h2':
    case 'h3':
    case 'i':
    case 'pre':
    case 'quote':
    case 'role':
    case 'spoiler':
    case 'strike':
    case 'sub':
    case 'time':
    case 'u':
    case 'user':
      throw new Error(`Unexpected text type: ${type}`);
    default:
      throw new Error(`Unhandled intrinsic type: ${type satisfies never}`);
  }
}

function cast<K extends keyof IntrinsicPropsMap>(
  _x: IntrinsicPropsMap[keyof IntrinsicPropsMap],
): asserts _x is IntrinsicPropsMap[K] {}
