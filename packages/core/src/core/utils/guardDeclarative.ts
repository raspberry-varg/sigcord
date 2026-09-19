import { coreLog } from '../../internal/coreLog.js';
import { useContext } from '../../lib/contexts/useContext.js';
import { ImperativeLockContext, ImperativeLockKind } from '../contexts/imperativeLock.js';

const LOCK_DESCRIPTIONS: Record<ImperativeLockKind, string> = {
  [ImperativeLockKind.InteractionHandler]: 'an interaction handler (e.g., inside a button click)',
  [ImperativeLockKind.Cleanup]: 'an onCleanup block',
  [ImperativeLockKind.Suspend]: 'a suspend hook',
  [ImperativeLockKind.Resume]: 'a resume hook',
};

export function guardDeclarative(functionName: string): void {
  const lock = useContext(ImperativeLockContext);
  if (lock == null) {
    return;
  }

  const readableLock = LOCK_DESCRIPTIONS[lock] ?? String(lock);
  const message = formatMessage(functionName, readableLock);
  coreLog.warn(message);
}

function formatMessage(functionName: string, readableLock: string): string {
  return `
[Sigcord Warning]: \`${functionName}()\` was called inside ${readableLock}.
Declarative hooks should only be called at the top level of your component.

This \`${functionName}\` will be destroyed when this lock is released.;
`.trim();
}
