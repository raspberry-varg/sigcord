import type { ReactivelyParams } from '@reactively/core';
import { Signal } from '../index.js';

export type ReactiveOptions = Omit<ReactivelyParams, 'effect'>;
export type MaybeSignal<T> = T | Signal<T>;
export function isSignal<T>(value: MaybeSignal<T>): value is Signal<T> {
  return value instanceof Signal;
}
