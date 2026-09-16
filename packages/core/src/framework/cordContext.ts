import type { Context } from '../lib/contexts/context.js';
import type { Cord } from './cord.js';

export const CordContext: Context<Cord | undefined> = {
  id: Symbol.for('__sigcord.CordContext'),
  default: undefined,
};
