import type {
  AwaitModalSubmitOptions,
  ModalBuilder,
  ModalSubmitInteraction,
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
    modalSubmit.fields.fields.entries(),
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
