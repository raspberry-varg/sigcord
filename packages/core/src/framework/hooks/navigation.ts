import type { Synapse } from '../../lib/menu/instance/synapse.js';
import { getCurrentSynapse } from '../../lib/builtins/builtins.js';
import type { ViewFactory } from '../menuBuilder.js';
import { useCordInternalOrThrow } from '../cordContext.js';

/**
 * Instantiate and navigate to a different view.
 *
 * - Can navigate back out of the view using {@link goBack}
 */
export const goTo: Synapse['goTo'] = (view, props) =>
  getCurrentSynapse().goTo(view, props);

/**
 * Navigate back to the calling view.
 *
 * @throws If not navigated to using {@link goTo}
 */
export const goBack: Synapse['goBack'] = () => getCurrentSynapse().goBack();

/**
 * Returns true if this view was navigated to using {@link goTo}. Safely allows
 * the use of {@link goBack} since the previous menu is on the navigation stack.
 */
export const canNavigateBack: Synapse['canGoBack'] = () =>
  getCurrentSynapse().canGoBack();

/**
 * Collection of navigation hooks bound to the current {@link Cord}.
 */
export interface Navigation {
  push(factory: () => ViewFactory): void;
  pop(): void;
  replace(factory: () => ViewFactory): void;
  canGoBack(): boolean;
}

/**
 * Navigation hooks.
 */
export function useNavigation(): Navigation {
  const cord = useCordInternalOrThrow();
  return {
    push: (factory) => cord.pushStrand(cord.createStrand(factory)),
    pop: () => cord.popStrand(),
    replace: (factory) => cord.replaceStrand(cord.createStrand(factory)),
    canGoBack: () => cord.canGoBack(),
  };
}
