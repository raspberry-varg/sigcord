import {type APITextDisplayComponent, ComponentType} from 'discord.js';

export function isTextDisplayData(
  obj: unknown,
): obj is APITextDisplayComponent {
  return (
    !!obj &&
    typeof obj === 'object' &&
    'type' in obj &&
    obj.type === ComponentType.TextDisplay
  );
}
