import { Reactive, reactive, type ReactivelyParams } from '@reactively/core';
import type { PatchTarget } from './RenderingEngine.js';

export type ReactiveOptions = Omit<ReactivelyParams, 'effect'>;
export type MaybeSignal<T> = T | Signal<T>;
export function isSignal<T>(value?: MaybeSignal<T>): value is Signal<T> {
  return typeof value === 'function' && SignalGetterSymbol in value;
}

export type MaybeWritableSignal<T> = T | WritableSignal<T>;
export function isWritableSignal<T>(
  value?: MaybeWritableSignal<T>
): value is WritableSignal<T> {
  return value instanceof Reactive;
}

const SignalGetterSymbol = Symbol('singal getter');
export type Signal<T> = (() => T) & { readonly [SignalGetterSymbol]: true };

export interface WritableSignal<T> extends Reactive<T> {
  readonly _patchContext: PatchTarget;
  isDefined(): this is WritableSignal<NonNullable<T>>;
  readonly(): Signal<T>;
  split(): SignalTuple<T>;
  get: Getter<T>;
}

type Getter<T> = Reactive<T>['get'] & { [SignalGetterSymbol]: true };
export type Setter<T> = Reactive<T>['set'];

export type SignalTuple<T> = [
  getter: Getter<T>,
  setter: Setter<T>,
  WritableSignal<T>
];

export function createSignal<T>(
  fnOrValue: T | (() => T),
  params: ReactiveOptions,
  patchContext: PatchTarget
): WritableSignal<T>;
export function createSignal<T>(
  fnOrValue: T | (() => T) | undefined,
  params: ReactiveOptions,
  patchContext: PatchTarget
): WritableSignal<T | undefined>;
export function createSignal<T>(
  fnOrValue: T | (() => T) | undefined,
  params: ReactiveOptions,
  patchContext: PatchTarget
): WritableSignal<T | undefined> {
  const signal = reactive(fnOrValue, params) as WritableSignal<T | undefined>;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  signal.isDefined = () => signal.get() !== null && signal.get() !== undefined;
  (signal as { _patchContext: PatchTarget })._patchContext = patchContext;
  signal.get[SignalGetterSymbol] = true;
  signal.readonly = () => signal.get.bind(signal);

  const getter = () => signal.get();
  getter[SignalGetterSymbol] = true as const;
  const setter: Setter<T> = (fnOrValue) => signal.set(fnOrValue);
  signal.split = () => [getter, setter, signal];

  return signal as WritableSignal<T | undefined>;
}

export interface EffectInstance {
  signal: WritableSignal<number>;
  previousVersion: number;
  patch?: PatchTarget;
}

/**
 * Resolves a possible signal to its held value.
 */
export function read<T>(
  maybeSignal: MaybeSignal<T> | MaybeWritableSignal<T> | T
): T {
  return isSignal(maybeSignal)
    ? maybeSignal()
    : isWritableSignal(maybeSignal)
    ? maybeSignal.get()
    : maybeSignal;
}
