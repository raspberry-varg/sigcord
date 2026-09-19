import type {CordAPI} from '../cord.js';
import {useCordInternalOrThrow} from '../cordContext.js';

export function useCord(): CordAPI {
  return useCordInternalOrThrow();
}
