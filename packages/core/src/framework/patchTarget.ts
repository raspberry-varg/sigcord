export type PatchTargetBitMask = number;

/**
 * The portion of a {@link ViewMessagePayload message payload} to update.
 */
export enum PatchTarget {
  None = 0,
  Embeds = 1,
  Components = 2,
  Content = 4,
  All = Embeds | Components | Content,
}
