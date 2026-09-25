import {
  type AnyComponent,
  APIButtonComponentWithCustomId,
  type APIComponentInContainer,
  APITextDisplayComponent,
  ComponentType,
} from 'discord.js';

import { clamp } from '../../util/clamp.js';
import { isDiscordAPIComponentType } from '../../util/discord/isDiscordAPIComponentType.js';

import type { IntrinsicPropsMap } from '../vdom/index.js';

const createStringSelectFallbackOption = (id: string) => ({
  label: `fallback-${id}`,
  value: `fallback-${id}`,
});

export function updateIntrinsicChildren<K extends keyof IntrinsicPropsMap>(
  type: K,
  props: Record<string, unknown>,
  cached: unknown,
  resolvedChildren: unknown,
  resolve: (vdom: unknown) => unknown,
): unknown {
  switch (type) {
    case 'separator': {
      // no-op
      return cached;
    }
    case 'text': {
      const textDisplay = cast(cached, ComponentType.TextDisplay);
      const childrenArray = Array.isArray(resolvedChildren) ? resolvedChildren : [resolvedChildren];
      textDisplay.content = childrenArray
        .filter((child) => child != null && child !== false)
        .join('');

      return textDisplay.content.length ? textDisplay : null;
    }
    case 'container': {
      const container = cast(cached, ComponentType.Container);

      const content: APIComponentInContainer[] = [];
      const childrenArray: unknown[] = Array.isArray(resolvedChildren)
        ? resolvedChildren
        : [resolvedChildren];
      for (const child of childrenArray) {
        if (typeof child === 'boolean' || typeof child === 'number' || typeof child === 'string') {
          const textDisplay: APITextDisplayComponent = {
            type: ComponentType.TextDisplay,
            content: String(child),
          };
          content.push(textDisplay);
          continue;
        }
        content.push(child as APIComponentInContainer);
      }

      if (content.length === 0) {
        return null;
      }

      container.components = content;
      return container;
    }
    case 'section': {
      const sectionProps = props as unknown as IntrinsicPropsMap['section'];
      const section = cast(cached, ComponentType.Section);

      // Resolve accessory
      const rawAccessory = sectionProps.accessory ? resolve(sectionProps.accessory) : [];
      const accessoryArray = Array.isArray(rawAccessory) ? rawAccessory : [rawAccessory];
      const validAccessory = accessoryArray.find(Boolean);

      // Pool text displays
      const textDisplays: APITextDisplayComponent[] = [];
      let currentString = '';
      const childrenArray: unknown[] = Array.isArray(resolvedChildren)
        ? resolvedChildren
        : [resolvedChildren];
      for (const child of childrenArray) {
        if (!child) continue;

        if (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') {
          currentString += String(child);
        } else {
          // Flush accumulated string.
          if (currentString) {
            textDisplays.push({ type: ComponentType.TextDisplay, content: currentString });
            currentString = '';
          }

          // Push the encountered component.
          if (isDiscordAPIComponentType(child, ComponentType.TextDisplay)) {
            textDisplays.push(child);
          } else {
            throw new Error(`Invalid child type for <section>. Expected TextDisplay.`);
          }
        }
      }
      if (currentString) {
        textDisplays.push({ type: ComponentType.TextDisplay, content: currentString });
      }

      if (!validAccessory) {
        return textDisplays;
      }

      // We have an accessory, let's return the full section.
      section.components = textDisplays;
      switch (validAccessory.type) {
        case ComponentType.Button:
          section.accessory = validAccessory;
          break;
        case ComponentType.Thumbnail:
          section.accessory = validAccessory;
          break;
        default:
          throw new Error(`Invalid accessory type: ${validAccessory.type}`);
      }

      return section;
    }
    case 'actionRow': {
      const actionRowProps = props as unknown as IntrinsicPropsMap['actionRow'];
      const actionRow = cast(cached, ComponentType.ActionRow);
      const resolved = resolve(actionRowProps.children);
      const resolvedArray = Array.isArray(resolved) ? resolved : [resolved];
      actionRow.components = resolvedArray.filter(
        (child) => child != null && typeof child !== 'boolean',
      );
      // TODO: Validate children.
      return actionRow.components.length ? actionRow : null;
    }
    case 'stringOption':
      return cached;
    case 'button': {
      const button = cast(cached, ComponentType.Button) as APIButtonComponentWithCustomId;
      const childrenArray = Array.isArray(resolvedChildren) ? resolvedChildren : [resolvedChildren];
      button.label = childrenArray.filter((child) => child != null && child !== false).join('');
      return button;
    }
    case 'stringSelect': {
      const stringSelectProps = props as unknown as IntrinsicPropsMap['stringSelect'];
      const stringSelect = cast(cached, ComponentType.StringSelect);
      const resolved = resolve(stringSelectProps.children);
      const resolvedArray = Array.isArray(resolved) ? resolved : [resolved];
      stringSelect.options = resolvedArray.filter(
        (child) => child != null && typeof child !== 'boolean',
      );
      // TODO: Validate children.

      // Clamp values
      stringSelect.options = stringSelect.options.slice(0, 25);
      if (stringSelect.options.length === 0) {
        stringSelect.options = [createStringSelectFallbackOption(stringSelect.custom_id)];
        stringSelect.disabled = true;
      }

      const max = stringSelect.max_values ?? 1;
      if (max === -1) {
        stringSelect.max_values = stringSelect.options.length;
      } else {
        stringSelect.max_values = clamp(max, 1, stringSelect.options.length);
      }

      const min = stringSelect.min_values ?? 0;
      stringSelect.min_values = clamp(min, 0, stringSelect.max_values);

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

function cast<T extends ComponentType>(object: unknown, type: T): AnyComponent & { type: T } {
  if (!isDiscordAPIComponentType(object, type)) {
    const received =
      object && typeof object === 'object' && 'type' in object && typeof object.type === 'number'
        ? ComponentType[object.type]
        : JSON.stringify(object);
    throw new Error(`Expected component type ${ComponentType[type]}, got ${received}`);
  }
  return object as AnyComponent & { type: T };
}
