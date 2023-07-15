import type {
  AwaitModalSubmitOptions,
  ModalBuilder,
  ModalSubmitInteraction,
} from 'discord.js';

export interface ModalBundleBlueprint {
  getModal: () => ModalBuilder;
  getSubmitOptions: () => AwaitModalSubmitOptions<ModalSubmitInteraction>;
  getSubmitHandler: () => (response: ModalSubmitInteraction) => any;
}

export type ModalBundle<Props = {}> = (props: Props) => ModalBundleBlueprint;
