import { Cord, type MountFinish } from './cord.js';
import { ComponentsV1Strand, type ComponentsV1ViewFactory } from './strands/componentsV1Strand.js';
import { ComponentsV2Strand } from './strands/componentsV2Strand.js';

import type { Context } from '../lib/contexts/context.js';
import type { InteractionMiddleware } from './interactionMiddleware.js';
import type { RepliableInteraction } from 'discord.js';

export type ViewFactory = () => unknown;

export type Wrapper = (children: unknown) => unknown;

/**
 * Entry point for all menus managed by Sigcord.
 */
export function composeCord(): CordComposer {
  return new CordComposer([], [], new Map(), false);
}

/**
 * Fluent builder for interactive menus. This is the entry point for all menus
 * managed by Sigcord.
 */
export class CordComposer<TProvided = never, TRequired = never> {
  constructor(
    private readonly middlewares: readonly InteractionMiddleware[],
    private readonly wrappers: readonly Wrapper[],
    private readonly injectedContexts: Map<Context<unknown>, unknown>,
    private readonly isEphemeral: boolean,
  ) {}

  /**
   * Requires a context to be provided to the menu before any mount method is called.
   *
   * This is purely a type-level assertion with no runtime validation.
   */
  requires<TNewContext extends Context<any>>(
    _context: TNewContext,
  ): CordComposer<TProvided, TRequired | TNewContext> {
    return this as any;
  }

  extends<TOtherProvided, TOtherRequired>(
    other: CordComposer<TOtherProvided, TOtherRequired>,
  ): CordComposer<
    TProvided | TOtherProvided,
    Exclude<TRequired | TOtherRequired, TProvided | TOtherProvided>
  > {
    return new CordComposer(
      concatDedupe(this.middlewares, other.middlewares),
      concatDedupe(this.wrappers, other.wrappers),
      extendMap(this.injectedContexts, other.injectedContexts),
      this.isEphemeral || other.isEphemeral,
    );
  }

  provide<T>(
    context: Context<T>,
    value: NoInfer<T>,
  ): CordComposer<TProvided | Context<T>, Exclude<TRequired, Context<T>>> {
    const extended = new Map(this.injectedContexts);
    extended.set(context, value);
    return new CordComposer(this.middlewares, this.wrappers, extended, this.isEphemeral);
  }

  ephemeral(value = true): CordComposer<TProvided, TRequired> {
    return new CordComposer(this.middlewares, this.wrappers, this.injectedContexts, value);
  }

  use(middleware: InteractionMiddleware): CordComposer<TProvided, TRequired> {
    return new CordComposer(
      [...this.middlewares, middleware],
      this.wrappers,
      this.injectedContexts,
      this.isEphemeral,
    );
  }

  wrap(wrapper: Wrapper): CordComposer<TProvided, TRequired> {
    return new CordComposer(
      this.middlewares,
      [...this.wrappers, wrapper],
      this.injectedContexts,
      this.isEphemeral,
    );
  }

  mount(
    interaction: RepliableInteraction,
    rootView: ViewFactory,
    ...[_missing]: [TRequired] extends [never]
      ? []
      : [
          {
            readonly ERROR: 'Cannot mount! Missing required contexts:';
            readonly MISSING: TRequired;
          },
        ]
  ): Promise<MountFinish> {
    const cord = new Cord(
      (thisCord, factory) => new ComponentsV2Strand(thisCord, factory, this.injectedContexts),
    );
    for (let i = 0; i < this.middlewares.length; i++) {
      cord.use(this.middlewares[i]);
    }
    const wrapped = this.applyWrappers(rootView);
    cord.pushStrand(cord.createStrand(wrapped));
    return cord.mount(interaction, this.isEphemeral);
  }

  async mountV1(
    interaction: RepliableInteraction,
    rootView: ComponentsV1ViewFactory,
    ...[_missing]: [TRequired] extends [never]
      ? []
      : [
          {
            readonly ERROR: 'Cannot mount! Missing required contexts:';
            readonly MISSING: TRequired;
          },
        ]
  ) {
    const cord = new Cord(
      (thisCord, factory) => new ComponentsV1Strand(thisCord, factory, this.injectedContexts),
    );
    for (let i = 0; i < this.middlewares.length; i++) {
      cord.use(this.middlewares[i]);
    }
    const wrapped = this.applyWrappers(rootView);
    cord.pushStrand(cord.createStrand(wrapped));
    return cord.mount(interaction, this.isEphemeral);
  }

  private applyWrappers(rootView: ViewFactory): ViewFactory {
    for (let i = this.wrappers.length - 1; i >= 0; i--) {
      const wrapper = this.wrappers[i];
      const inner = rootView;
      rootView = () => wrapper(inner);
    }
    return rootView;
  }
}

function concatDedupe<T>(a: readonly T[], b: readonly T[]): T[] {
  return [...new Set([...a, ...b])];
}

function extendMap<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>): Map<K, V> {
  return new Map([...a, ...b]);
}
