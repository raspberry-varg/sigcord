import { logger } from '../../../util/Logger.js';
import type { DisposeFn } from '../../render/dispose.js';
import { getOpenOwner, setCurrentOwner } from '../../render/owner.js';
import type { PatchTarget } from '../../RenderingEngine.js';
import * as core from '@preact/signals-core';

const WRITABLE_STAMP = Symbol('writable');
const GETTER_STAMP = Symbol('getter');
const SETTER_STAMP = Symbol('setter');
const FROM_SIGNAL = Symbol('signal source instance');

export type Signalish<T> = Signal<T> | WritableSignal<T>;
export type MaybeSignalish<T> = T | Signalish<T>;
export type UnwrapSignalish<T> = T extends Signalish<infer S> ? S : T;

export type MaybeSignal<T> = T | Signal<T>;
export function isSignal<T>(value?: T | Signalish<T>): value is Signal<T> {
  return typeof value === 'function';
}
export function isStampedSignal<T>(
  value?: T | Signalish<T>,
): value is Signal<T> {
  return isSignal(value) && GETTER_STAMP in value;
}

export type MaybeWritableSignal<T> = T | Signalish<T>;
export function isWritableSignal<T>(
  value?: T | Signalish<T>,
): value is WritableSignal<T> {
  return HasWritableSignalStamp(value);
}

export function HasWritableSignalStamp<T>(
  value?: T,
): value is T & { [WRITABLE_STAMP]: true } {
  return value != null && typeof value === 'object' && WRITABLE_STAMP in value;
}

export interface Signal<T> {
  (): T;
}

export interface WritableSignal<T> extends core.Signal<T> {
  readonly _patchContext: PatchTarget;
  get: Getter<T>;
  set: Setter<T>;
  update: Updater<T>;
  isDefined(): this is WritableSignal<NonNullable<T>>;
  readonly(): Signal<T>;
  split(): SignalTuple<T>;
}

type WritableSignalInternal<T> = {
  -readonly [x in keyof WritableSignal<T>]: WritableSignal<T>[x];
};

type UpdateFn<T> = (oldVal: T) => T;

type Getter<T> = () => T;

export interface Setter<T> {
  (newVal: T): void;
  (setter: UpdateFn<T>): void;
}

export type Updater<T> = (updater: UpdateFn<T>) => void;

export type SignalTuple<T> = [
  getter: Getter<T>,
  setter: Setter<T>,
  WritableSignal<T>,
];

export function createSignal<T>(
  initialVal: T,
  patchContext: PatchTarget,
): WritableSignal<T>;
export function createSignal<T>(
  initialVal: T | undefined,
  patchContext: PatchTarget,
): WritableSignal<T | undefined>;
export function createSignal<T>(
  initialVal: T | undefined,
  patchContext: PatchTarget,
): WritableSignal<T | undefined> {
  const s = core.signal(initialVal);
  const w = s as WritableSignalInternal<T | undefined>;
  (w as any)[WRITABLE_STAMP] = true;
  (w as any)._patchContext = patchContext;

  w.get = () => s.value;
  (w.get as any)[FROM_SIGNAL] = s;
  (w.get as any)[GETTER_STAMP] = true;
  w.set = (v) =>
    (s.value =
      typeof v === 'function' ? (v as UpdateFn<T | undefined>)(w.peek()) : v);
  (w.set as any)[FROM_SIGNAL] = s;
  (w.set as any)[SETTER_STAMP] = s;
  w.update = (updater) => {
    const cur = s.peek();
    w.set(updater(cur));
  };
  (w.update as any)[FROM_SIGNAL] = s;
  w.isDefined = (): this is WritableSignal<NonNullable<T>> => {
    const v = s.peek();
    return v !== null && v !== undefined;
  };
  w.readonly = () => w.get.bind(w);
  w.split = () => [w.get.bind(w), w.set.bind(w), w];

  return w;
}

export function createUntracked<T>(signal: () => T): T {
  return core.untracked(signal);
}

export function createComputed<T>(derived: () => T): Getter<T> {
  const capturedOwner = getOpenOwner();
  const computed = core.computed(() => {
    const prevOwner = setCurrentOwner(capturedOwner);
    let value;
    try {
      value = derived();
    } finally {
      setCurrentOwner(prevOwner);
    }
    return value;
  });
  return Object.assign(() => computed.value, { [GETTER_STAMP]: true });
}

/**
 * Effect function that optionally returns a disposal function to call when the
 * effect reruns or is disposed.
 */
export type EffectFn = () => void | DisposeFn;

let id = 1;

export function createEffect(action: EffectFn): DisposeFn {
  const capturedId = id++;
  logger.verbose(
    `creating a new effect. action=${action}, effectId=${capturedId}`,
  );
  const capturedOwner = getOpenOwner();
  return core.effect(() => {
    const prevOwner = setCurrentOwner(capturedOwner);
    let dispose;
    try {
      dispose = action();
    } finally {
      setCurrentOwner(prevOwner);
    }
    return () => {
      logger.debug(`disposing effectId=${capturedId}`);
      dispose?.();
    };
  });
}
