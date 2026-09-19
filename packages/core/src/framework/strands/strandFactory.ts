import type { Cord } from '../cord.js';
import type { ViewFactory } from '../menuBuilder.js';
import type { Strand } from './strand.js';

export type StrandFactory = (cord: Cord, ViewFactory: ViewFactory) => Strand;
