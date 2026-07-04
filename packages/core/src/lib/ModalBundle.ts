import {
  AwaitModalSubmitOptions,
  ComponentType,
  ModalBuilder,
  ModalSubmitInteraction,
  type TextInputModalData,
} from 'discord.js';

// eslint-disable-next-line @typescript-eslint/ban-types
export type ModalBundle<Props = {}> = (props: Props) => ModalBundleBlueprint;

export interface ModalBundleBlueprint {
  getModal: () => ModalBuilder;
  getSubmitOptions: () => AwaitModalSubmitOptions<ModalSubmitInteraction>;
  getSubmitHandler: () => ModalSubmitHandler;
}

type ModalSubmitHandler = (response: ModalSubmitInteraction) => unknown;
// eslint-disable-next-line @typescript-eslint/ban-types
type ModalSubmitHandlerWithValues<Values extends {}> = (
  response: ModalSubmitInteraction,
  values: Values,
) => unknown;

// eslint-disable-next-line @typescript-eslint/ban-types
function extractModalSubmitValues<Values extends {}>(
  modalSubmit: ModalSubmitInteraction,
): Values {
  const entries = Array.from(
    modalSubmit.fields.fields
      .entries()
      .filter(
        (e): e is [(typeof e)[0], TextInputModalData] =>
          e[1].type === ComponentType.TextInput,
      ),
    ([key, { value }]) => {
      return [key, value];
    },
  );
  return Object.fromEntries(entries);
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function useValues<Values extends {}>(
  modalSubmitHandler: ModalSubmitHandlerWithValues<Values>,
): ModalSubmitHandler {
  return (response) => {
    const values = extractModalSubmitValues<Values>(response);
    return modalSubmitHandler(response, values);
  };
}
