import { useContext } from '../../lib/contexts/useContext.js';
import { useCordInternalOrThrow } from '../cordContext.js';
import { StaticCordContext } from '../staticCordContext.js';

import type { CordAPI } from '../cord.js';

export function useCord(): CordAPI {
  return useContext(StaticCordContext) ?? useCordInternalOrThrow();
}
