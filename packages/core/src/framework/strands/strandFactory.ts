import type { Cord } from '../cord.js';
import type { ViewFactory } from '../cordComposer.js';
import type { Strand } from './strand.js';

export type StrandFactory = (cord: Cord, ViewFactory: ViewFactory) => Strand;
