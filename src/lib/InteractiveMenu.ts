import type { Message, RepliableInteraction } from 'discord.js';
import type { IntrinsicViewProps } from './MenuView';
import { View } from './FunctionalMenuView';
import { MenuController } from './MenuController';

export interface Menu<Views extends ViewDefinitions = {}> {
  id: string;
  initialView: Views extends ViewArrayDefinitions ? string : keyof Views;
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
   */
  ephemeral: boolean | false;
  /**
   * Existing message to listen for components from.
   */
  initialMessage?: Message;
}

// To whoever just Ctrl+Clicked, I'm so sorry for all this type mangling, but it works.
type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer I
) => void
  ? I
  : never;
type ArrayUnionToIntersection<U> = U extends Array<infer T>
  ? UnionToIntersection<T>
  : never;
type ObjectUnionToIntersection<U> = U extends Record<string, infer T>
  ? UnionToIntersection<T>
  : never;

type ViewArrayDefinitions = View[];
type ViewRecordDefinitions = Record<string, unknown> & Record<string, View>;
export type ViewDefinitions = ViewArrayDefinitions | ViewRecordDefinitions;

type AllPropertiesOfRecord<Views extends ViewRecordDefinitions> =
  ObjectUnionToIntersection<{
    [KView in keyof Views]: Parameters<Views[KView]['render']>[0];
  }>;
type AllPropertiesOfArray<Views extends ViewArrayDefinitions> =
  ArrayUnionToIntersection<{
    [KView in keyof Views]: Parameters<Views[KView]['render']>[0];
  }>;

type ResolveAllPropertiesOf<Views extends ViewDefinitions> =
  Views extends ViewArrayDefinitions
    ? AllPropertiesOfArray<Views>
    : Views extends ViewRecordDefinitions
    ? AllPropertiesOfRecord<Views>
    : never;

type AllPropertiesOf<Views extends ViewDefinitions> =
  ResolveAllPropertiesOf<Views>;

/**
 * Define an interactive menu.
 * @param definition All required interactive menu properties.
 * @param definition.id The unique ID of this menu. Used in component `customId`s.
 * @param definition.views All views that this menu utilizes.
 * @param definition.initialView The view that should be rendered first.
 * @param definition.intrinsic Override default values for intrinsic properties.
 */
export function DefineMenu<
  Views extends ViewDefinitions,
  Props extends AllPropertiesOf<Views> & Partial<IntrinsicMenuProps>
>(definition: {
  id: string;
  initialView: Views extends ViewArrayDefinitions ? string : keyof Views;
  views: Views;
  intrinsic?: Partial<IntrinsicMenuProps>;
}) {
  const { id, initialView, views, intrinsic } = definition;

  // check if initial view is valid
  const idToClass = new Map<string, View>();
  if (Array.isArray(views)) {
    // convert array to map of id to view class
    for (const view of views) {
      // quick initialization to get the user-defined id
      const id = new view({}).id;
      if (idToClass.has(id)) {
        throw new InteractiveMenuError(
          `Id '${id}' already exists in this interactive menu.`
        );
      }
      idToClass.set(id, view);
    }
  } else {
    // remap record key-value pairs into map
    for (const [id, view] of Object.entries(views)) {
      if (idToClass.has(id)) {
        throw new InteractiveMenuError(
          `Id '${id}' already exists in this interactive menu.`
        );
      }
      idToClass.set(id, view);
    }
  }
  if (!idToClass.has(initialView)) {
    throw new InteractiveMenuError(
      `Initial view ID: "${initialView}" is not a registered view.`
    );
  }

  // factory callback
  return (interaction: RepliableInteraction, props: Props) => {
    // construct controller
    const menu = MenuController<Props, typeof initialView>(
      id,
      [...idToClass.values()],
      interaction,
      { ...intrinsic, ...props }
    );
    return menu;
  };
}

class InteractiveMenuError extends Error {
  constructor(message: string) {
    super(message);
  }
}
