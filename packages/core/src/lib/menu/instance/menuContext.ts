import type { CollectedMessageInteraction, RepliableInteraction } from 'discord.js';

/**
 * @deprecated Please migrate away from these context values.
 */
export interface MenuContext {
  /**
   * The latest interaction this menu is bound to.
   *
   * Note: If `props.renderAfterHandledInteraction` is set to `true`,
   *       this is the latest collected interaction (i.e. a component interaction).
   */
  interaction: RepliableInteraction;
  /** @internal */
  lastCollectedInteraction?: CollectedMessageInteraction;
  /**
   * The current menu idle time in milliseconds.
   */
  get idleTimeMs(): number;
  /**
   * The id of this context's menu.
   */
  menuId: string;
  /**
   * The id of the initial view.
   */
  initialViewId: string;
}
