import { createInternalContext } from './createInternalContext.js';

export interface ComponentsV1ImperativeAPI {
  queueEmbeds: (...embeds: unknown[]) => void;
  prependEmbeds: (...embeds: unknown[]) => void;
  queueComponents: (...components: unknown[]) => void;
  prependComponents: (...components: unknown[]) => void;
}

export const ComponentsV1ImperativeAPIContext = createInternalContext<ComponentsV1ImperativeAPI>(
  'ComponentsV1ImperativeAPI',
);
