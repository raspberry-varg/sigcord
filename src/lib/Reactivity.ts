import type { ReactivelyParams } from '@reactively/core';
import type { Signal } from '../index.js';

export type ReactiveOptions = Omit<ReactivelyParams, 'effect'>;
export type MaybeSignal<T> = T | Signal<T>;
