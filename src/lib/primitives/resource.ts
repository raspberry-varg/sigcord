import type { MaybePromise } from '../../util/TypesUtil.js';
import { effect, suspend, update, withDefer } from '../ReactiveBuiltIns.js';
import { read, type Setter, type Signal } from '../Reactivity.js';
import { untracked } from '../reactivity/untracked.js';
import { computed, signal } from '../primitives.js';

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

export function resource<T>(
  fetcher: ResourceFetcher<T, true>,
): ResourceTuple<T | undefined>;
export function resource<T, SOURCE>(
  options: ResourceOptions<T, SOURCE>,
  fetcher: ResourceFetcher<T, SOURCE>,
): ResourceTuple<T>;
/**
 * Create a computed signal that autopopulates with the resolved value from the
 * provided asynchronous task.
 *
 * ```ts
 * const [user, mutateUser, refreshUser] = resource(() => fetchUserDb());
 * const embed = createEmbed().setTitle('User Info');
 * componentEffect(() => {
 *   if (user.isLoading()) {
 *     embed.setDescription('Loading...');
 *   }
 *   const u = user();
 *   embed.setDescription(`Viewing information for ${u.name}.`);
 * });
 * return {
 *   embeds: [embed],
 * };
 * ```
 *
 * @returns Tuple with a resource, mutator for optimistic updates, and a refresh
 * function that reruns the provided task.
 */
export function resource<T, SOURCE>(
  fetcherOrOptions: ResourceFetcher<T, SOURCE> | ResourceOptions<T, SOURCE>,
  fetcherOrUndefined?: ResourceFetcher<T, SOURCE>,
): ResourceTuple<T | undefined> {
  let options: ResourceOptions<T, SOURCE>;
  let fetcher: ResourceFetcher<T, SOURCE>;

  if (fetcherOrUndefined !== undefined) {
    options = typeof fetcherOrOptions === 'object' ? fetcherOrOptions : {};
    fetcher = fetcherOrUndefined;
  } else if (typeof fetcherOrOptions !== 'object') {
    options = {};
    fetcher = fetcherOrOptions;
  } else {
    throw new Error('Invalid override.');
  }

  const [data, setData] = signal<T | undefined>(options.initialValue);
  const [error, setError] = signal<unknown | null>(null);
  const [loading, setLoading] = signal(false);

  const resumeContext = suspend();

  const fetch = async (source: SOURCE) => {
    resumeContext();
    const cacheHit = options.tryCache?.(source);
    if (cacheHit) {
      setData(cacheHit);
      setError(null);
      setLoading(false);
      return;
    }

    resumeContext();
    setLoading(true);
    try {
      const res = await withDefer(fetcher(source));
      setData(res);
      setError(null);
      if (options.autoUpdate) {
        resumeContext();
        void update();
      }
    } catch (e: unknown) {
      setError(e);
      if (options.autoUpdate) {
        resumeContext();
        void update();
      }
    } finally {
      setLoading(false);
    }
  };

  if (options.source) {
    let firstTime = true;
    effect(() => {
      const src = read(options.source);
      if (src) {
        if (firstTime) {
          firstTime = false;
          if (options.initialValue) {
            return;
          }
        }
        void fetch(src);
      }
    });
  } else {
    if (!options.initialValue) {
      void fetch(true as SOURCE);
    }
  }

  const r = data as Resource<T | undefined>;
  r.loading = loading;
  r.error = error;

  let ready: Signal<boolean> | undefined;
  let errored: Signal<boolean> | undefined;
  Object.defineProperties(r, {
    ready: {
      get(): Signal<boolean> {
        return (ready ??= computed(() => !r.loading() && !r.error()));
      },
    },
    errored: {
      get(): Signal<boolean> {
        return (errored ??= computed(() => !!r.error()));
      },
    },
  });

  return [
    r,
    setData,
    () => {
      if (options.source) {
        const src = untracked(() => read(options.source));
        if (src) return fetch(src);
      } else {
        return fetch(true as SOURCE);
      }
    },
  ];
}
