import {APIThumbnailComponent, ComponentType} from 'discord.js';

export function isThumbnailData(val: unknown): val is APIThumbnailComponent {
  return (
    typeof val === 'object' &&
    (val as Record<string, unknown>).type === ComponentType.Thumbnail
  );
}
