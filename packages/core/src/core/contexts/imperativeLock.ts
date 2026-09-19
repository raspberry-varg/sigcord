import {createInternalContext} from './createInternalContext.js';

export const ImperativeLockContext = createInternalContext<ImperativeLockKind>(
  'ImperativeLockContext',
);

export enum ImperativeLockKind {
  InteractionHandler = 1,
  Cleanup = 2,
  Suspend = 3,
  Resume = 4,
}
