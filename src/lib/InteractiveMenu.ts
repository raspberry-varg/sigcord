import type { Message, RepliableInteraction } from 'discord.js';
import type { IntrinsicViewProps } from './MenuView.js';
import { View, type DefinedView } from './views/view.js';
import { MenuController, type MenuControllerAPI } from './MenuController.js';
import type { PropsBase } from './MenuView/ViewBase.js';
import type { ArrayUnionToIntersection } from '../util/TypesUtil.js';

type ViewDefinitions = DefinedView<any>[];

export interface Menu<Views extends ViewDefinitions = []> {
  id: string;
  initialView: string;
  views: Views;
  intrinsic?: Partial<IntrinsicMenuProps>;
}

export interface IntrinsicMenuProps extends IntrinsicViewProps {
  /**
   * When a message component is handled, call {@link render()}.
   * @default true
   */
  renderAfterHandledInteraction: boolean | true;
  /**
   * Make this menu render its views as a private message.
   * @default false
   * @deprecated Use {@link flags} instead
   */
  ephemeral: boolean | false;
  /**
   * Existing message to listen for components from.
   */
  initialMessage?: Message;
  /**
   * Time in milliseconds to wait before timing out a menu for inactivity.
   */
  idleTimeMs?: number;
}

/**
 * Define an interactive menu.
 * @param definition All required interactive menu properties.
 * @param definition.id The unique ID of this menu. Used in component `customId`s.
 * @param definition.views All views that this menu utilizes.
 * @param definition.initialView The view that should be rendered first.
 * @param definition.intrinsic Override default values for intrinsic properties.
 */
export function defineMenu<
  Views extends ViewDefinitions,
  Props extends Partial<IntrinsicMenuProps> &
    ArrayUnionToIntersection<{
      [K in keyof Views]: Views[K] extends MenuFactory<infer P> ? P : never;
    }>,
>(definition: {
  id: string;
  initialView: string;
  views: Views;
  intrinsic?: Partial<IntrinsicMenuProps>;
}): MenuFactory<Props> {
  const { id, initialView, views, intrinsic } = definition;

  // check if initial view is valid
  const idToClass = new Map<string, View>();
  // convert array to map of id to view class
  for (const view of views as Views) {
    const id = view.id;
    if (idToClass.has(id)) {
      throw new InteractiveMenuError(
        `Id '${id}' already exists in this interactive menu.`,
      );
    }
    idToClass.set(id, view);
  }
  if (!idToClass.has(initialView)) {
    throw new InteractiveMenuError(
      `Initial view ID: "${initialView}" is not a registered view.`,
    );
  }

  // factory callback
  const factory = (interaction: RepliableInteraction, props: Props) => {
    // construct controller
    const menu = MenuController<Props, typeof initialView>(
      id,
      initialView,
      [...idToClass.values()],
      interaction,
      { ...intrinsic, ...props },
    );
    return menu;
  };
  return factory;
}

export type MenuFactory<Props extends PropsBase> = (
  interaction: RepliableInteraction,
  props: Props & Partial<IntrinsicMenuProps>,
) => MenuControllerAPI;

class InteractiveMenuError extends Error {
  constructor(message: string) {
    super(message);
  }
}
