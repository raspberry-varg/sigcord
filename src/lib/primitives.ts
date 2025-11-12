import type { Synapse } from './menu/synapse.js';
import {
  effect,
  suspend,
  update,
  useSynapse,
  withDefer,
} from './ReactiveBuiltIns.js';
import {
  type ResourceTuple,
  type Resource,
  type Signal,
  type ResourceOptions,
  type ResourceFetcher,
  read,
} from './Reactivity.js';
import { untracked } from './reactivity/untracked.js';

/**
 * Create a new signal.
 *
 * Signals are functions that allow for fine-grained reactivity in an app,
 * triggering reactions ("effects") **only if** their value changes.
 *
 * ```ts
 * const [clicks, setClicks] = signal(0);
 * const button = createDiscordButton();
 * componentEffect(() => {
 *   // subscribes to this signal and re-runs any time this signal changes
 *   button.label = `You have clicked me ${clicks()} times.`;
 * });
 *
 * return component({
 *   id: 'my-component',
 *   controller: (buttonInteraction) => {
 *     // updates clicks without reading the signal
 *     setClicks((prev) => prev + 1);
 *   }
 * });
 * ```
 *
 * In DIM, signals automatically bind to the render cycle. If you need to
 * completely re-run an entire function if any subscribed signal changes, or to
 * incrementally migrate a component to be fully reactive, wrap the embed or
 * component in a closure:
 *
 * ```ts
 * const [clicks, setClicks] = signal(0);
 * return {
 *   embeds: [
 *     () =>
 *       new EmbedBuilder()
 *         .setDescription(`You clicked the button below ${clicks()} times!`),
 *   ],
 *   components: [
 *     // ...
 *   ]
 * }
 * ```
 *
 * @param initialValue The initial value to set to the signal. Omit to assign
 *    later.
 * @returns Signal tuple with a signal getter and setter.
 */
export const signal: Synapse['createSignal'] = <T>(
  initialValue: T | undefined = undefined,
) => useSynapse().createSignal(initialValue);

/**
 * Create an object to modify and read from a single signal. Capable of being
 * split into a signal tuple or standalone signal.
 * @param initialValue The initial value to set to the signal. Omit to assign
 *    later.
 * @returns Object containing signal read and mutators.
 */
export const writable: Synapse['createWritableSignal'] = <T>(
  initialValue: T | undefined = undefined,
) => useSynapse().createWritableSignal(initialValue);

/**
 * Create a signal that only updates if any of its dependencies change.
 * @param derived Function with signal reads.
 * @returns Signal that has subscribed to any signals read during its initial
 *    call.
 */
export const computed: Synapse['createComputed'] = <T>(derived: () => T) =>
  useSynapse().createComputed(derived);

/**
 * Create a signal with a trigger function.
 *
 * Useful for manually triggering subscribed effects.
 *
 * @returns Tuple containing a tracking signal and a function to trigger any
 *   subscribed effects.
 */
export function trigger(): [track: Signal<void>, dirty: () => void] {
  const [toggle, setToggle] = signal(false);
  return [toggle, () => setToggle((prev) => !prev)];
}

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
