import {
  ButtonBuilder,
  ButtonStyle,
  type MessageActionRowComponentBuilder,
} from 'discord.js';

/**
 * Special id attached to one of the pre-configured {@link AutoComponents}.
 */
export enum AutoComponentId {
  CloseMenuButton = '%%RSRV%%_CloseMenuButton',
}

/**
 * Pre-configured components that trigger special actions when interacted with.
 */
export const AutoComponents = {
  /**
   * Button that automatically closes the menu when clicked.
   */
  CloseMenuButton: () => withConfiguration(AutoComponentId.CloseMenuButton),
} as const;

const COMPONENT_FACTORIES = {
  [AutoComponentId.CloseMenuButton]: () =>
    new ButtonBuilder({
      style: ButtonStyle.Secondary,
      label: 'Close',
    }),
} as const;

type Factories = typeof COMPONENT_FACTORIES;

type ComponentMutator<T extends MessageActionRowComponentBuilder> = (
  component: T,
) => void;

type BuilderDef<T extends AutoComponentId> = ReturnType<Factories[T]>;

const configurations = new Map<
  AutoComponentId,
  ComponentMutator<BuilderDef<AutoComponentId>>
>();

function withConfiguration<T extends AutoComponentId>(
  componentId: T,
): ReturnType<Factories[T]> {
  const factory = COMPONENT_FACTORIES[componentId];
  const instance = factory();

  instance.setCustomId(componentId);
  const mutator = configurations.get(componentId);
  mutator?.(instance);
  return instance as ReturnType<Factories[T]>;
}

// export function configureAutoComponents(configuration: {
//   [K in AutoComponentId]: ComponentMutator<BuilderDef<K>>;
// }) {
//   for (const [key, val] of Object.entries(configuration)) {
//     configurations.set(key as AutoComponentId, val);
//   }
// }

export function configureAutoComponent<Id extends AutoComponentId>(
  id: Id,
  mutator: ComponentMutator<BuilderDef<Id>>,
) {
  configurations.set(id, mutator as any);
}
