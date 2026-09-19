import { useCordInternalOrThrow } from '../cordContext.js';

import type { CordAPI } from '../cord.js';

export function useCord(): CordAPI {
  return useCordInternalOrThrow();
}
