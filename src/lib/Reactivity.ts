import { Reactive, reactive, type ReactivelyParams } from '@reactively/core';
import type { PatchTarget } from './RenderingEngine.js';

export type ReactiveOptions = Omit<ReactivelyParams, 'effect'>;
export type MaybeSignal<T> = T | Signal<T>;
export function isSignal<T>(value?: MaybeSignal<T>): value is Signal<T> {
  return value instanceof Reactive;
}

export interface Signal<T> extends Reactive<T> {
  readonly _patchContext: PatchTarget;
  isDefined(): this is Signal<NonNullable<T>>;
}

export function createSignal<T>(
  fnOrValue: T | (() => T),
  params: ReactiveOptions,
  patchContext: PatchTarget
): Signal<T>;
export function createSignal<T>(
  fnOrValue: T | (() => T) | undefined,
  params: ReactiveOptions,
  patchContext: PatchTarget
): Signal<T | undefined>;
export function createSignal<T>(
  fnOrValue: T | (() => T) | undefined,
  params: ReactiveOptions,
  patchContext: PatchTarget
): Signal<T | undefined> {
  const signal = reactive(fnOrValue, params) as Signal<T | undefined>;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  signal.isDefined = () => signal.get() !== null && signal.get() !== undefined;
  (signal as { _patchContext: PatchTarget })._patchContext = patchContext;
  return signal as Signal<T | undefined>;
}
export interface EffectInstance {
  signal: Signal<number>;
  previousVersion: number;
  patch?: PatchTarget;
}
