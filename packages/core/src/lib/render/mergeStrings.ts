import { ComponentType } from 'discord.js';

import { isDiscordAPIComponentType } from '../../util/discord/isDiscordAPIComponentType.js';

export function mergeStrings(out: unknown[], next: unknown): void {
  if (Array.isArray(next)) {
    for (let i = 0; i < next.length; i++) {
      mergeStrings(out, next[i]);
    }
    next.length = 0;
    return;
  }

  if (out.length === 0) {
    out.push(next);
    return;
  }

  const lastIdx = out.length - 1;
  const last = out[lastIdx];

  if (typeof last === 'string' && typeof next === 'string') {
    out[lastIdx] += next;
  } else if (
    isDiscordAPIComponentType(last, ComponentType.TextDisplay) &&
    isDiscordAPIComponentType(next, ComponentType.TextDisplay)
  ) {
    out[lastIdx] = {
      ...last,
      content: last.content + next.content,
    };
  } else {
    out.push(next);
  }
}
