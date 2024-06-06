import {
  Reactive as Signal,
  reactive,
  type ReactivelyParams,
} from '@reactively/core';

export type ReactiveOptions = Omit<ReactivelyParams, 'effect'>;
export type MaybeSignal<T> = T | Signal<T>;
export function isSignal<T>(value: MaybeSignal<T>): value is Signal<T> {
  return value instanceof Signal;
}
export { Signal };

export function createSignal<T>(): Signal<T | undefined>;
export function createSignal<T>(
  fnOrValue: undefined,
  params?: ReactivelyParams
): Signal<T | undefined>;
export function createSignal<T>(
  fnOrValue: T | (() => T),
  params?: ReactivelyParams
): Signal<T>;
export function createSignal<T>(
  fnOrValue?: T | (() => T) | undefined,
  params?: ReactiveOptions
): Signal<T | undefined> {
  return reactive(fnOrValue, params);
}
