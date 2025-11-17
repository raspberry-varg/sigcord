import type {
  CollectedMessageInteraction,
  RepliableInteraction,
} from 'discord.js';
import {
  INTERNAL_CONTEXT_SYMBOL,
  type InternalMenuContext,
} from './internalMenuContext.js';

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
  /** @internal */
  activeInteraction: RepliableInteraction;
  /** @internal */
  isActivelyPatching: boolean;
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

export interface MenuContextWithInternal extends MenuContext {
  [INTERNAL_CONTEXT_SYMBOL]: InternalMenuContext;
}
