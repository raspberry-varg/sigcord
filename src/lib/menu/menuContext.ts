import type { RepliableInteraction } from 'discord.js';

export interface MenuContext {
  /**
   * The latest interaction this menu is bound to.
   *
   * Note: If `props.renderAfterHandledInteraction` is set to `true`,
   *       this is the latest collected interaction (i.e. a component interaction).
   */
  interaction: RepliableInteraction;
  /**
   * The reaction provided when initializing this menu.
   *
   * Useful if `props.renderAfterHandledInteraction` is set to `true`.
   */
  readonly initialInteraction: RepliableInteraction;
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
