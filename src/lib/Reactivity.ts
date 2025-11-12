import { logger } from '../util/Logger.js';
import type { DisposeFn } from './render/dispose.js';
import { getOpenOwner, setCurrentOwner } from './render/owner.js';
import type { PatchTarget } from './RenderingEngine.js';
import * as core from '@preact/signals-core';
import type { MaybePromise } from '../util/TypesUtil.js';
import type { update } from './ReactiveBuiltIns.js';

const WRITABLE_STAMP = Symbol('writable');
const GETTER_STAMP = Symbol('getter');
const SETTER_STAMP = Symbol('setter');
const FROM_SIGNAL = Symbol('signal source instance');

export type Signalish<T> = Signal<T> | WritableSignal<T>;
export type MaybeSignalish<T> = T | Signalish<T>;
export type UnwrapSignalish<T> = T extends Signalish<infer S> ? S : T;

export type MaybeSignal<T> = T | Signalish<T>;
export function isSignal<T>(value?: T | Signalish<T>): value is Signal<T> {
  return typeof value === 'function' && GETTER_STAMP in value;
}

export type MaybeWritableSignal<T> = T | Signalish<T>;
export function isWritableSignal<T>(
  value?: T | Signalish<T>,
): value is WritableSignal<T> {
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

/**
 * Thin wrapper over {@link Signal} that allows for asynchronous data fetching.
 */
export type Resource<T> = Signal<T> & {
  /**
   * `true` while executing {@link ResourceFetcher}.
   */
  loading: Signal<boolean>;
  /**
   * Holds an error encountered when executing {@link ResourceFetcher}.
   */
  error: Signal<unknown | null>;
  /**
   * `true` if not {@link loading} and not {@link errored}.
   */
  ready: Signal<boolean>;
  /**
   * `true` if {@link error} is falsy.
   */
  errored: Signal<boolean>;
};

export type ResourceTuple<T> = [
  data: Resource<T | undefined>,
  mutate: Setter<T | undefined>,
  refetch: () => void,
];

/**
 * Options to configure a new {@link Resource}.
 */
export interface ResourceOptions<T, SOURCE> {
  /**
   * Link this resource to a signal.
   *
   * When the source updates:
   * *   {@link tryCache} is called.
   * *   If {@link tryCache} fails, call the provided {@link ResourceFetcher}.
   */
  source?: SOURCE | Signal<SOURCE>;
  /**
   * Skip the initial call to {@link ResourceFetcher} if an initial value is
   * already available.
   */
  initialValue?: T;
  /**
   * Attempt to provide `T` from a synchronously-available data store.
   *
   * If `T` is returned:
   * *   {@link ResourceFetcher} is not called.
   * *   The resource resolves synchronously.
   * *   It attempts to update the view as an edit or update to the latest
   *     interaction, bypassing {@link ResourceFetcher}'s `deferUpdate()`.
   *
   * @param source
   */
  tryCache?: (source: SOURCE) => T | false | null | undefined;
  /**
   * Call {@link update} when the fetcher resolves or an error is captured.
   *
   * @default true
   */
  autoUpdate?: boolean;
}

export type ResourceFetcher<T, SOURCE> = (source: SOURCE) => MaybePromise<T>;

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
  w._patchContext = patchContext;

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

/**
 * Resolves a possible signal to its held value.
 */
export function read<T>(maybeSignal: T | Signal<T> | WritableSignal<T>): T {
  return isWritableSignal(maybeSignal)
    ? maybeSignal.get()
    : isSignal(maybeSignal) || typeof maybeSignal === 'function'
      ? (maybeSignal as () => T)()
      : maybeSignal;
}

export function getWritable<T>(signal: Getter<T>): WritableSignal<T> {
  return (signal as any)[FROM_SIGNAL];
}
