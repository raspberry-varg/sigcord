import {type APIButtonComponent, ComponentType} from 'discord.js';

export function isButtonData(obj: unknown): obj is APIButtonComponent {
  return (
    !!obj &&
    typeof obj === 'object' &&
    'type' in obj &&
    obj.type === ComponentType.Button
  );
}
