import {
  type SelectMenuComponentOptionData,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
  type StringSelectMenuOptionBuilder,
} from 'discord.js';

import {
  type DisposeFn,
  type Setter,
  type Signal,
  component,
  computed,
  flattenToContentNodes,
  getNextUniqueComponentId,
  onCleanup,
  owner,
  patchEffect,
  read,
  signal,
} from '@sigcord/core';

import type {JSXElement} from '../index.js';
import {clamp} from '../util/clamp.js';
import {
  type BaseSelectMenuProps,
  applyPatchEffect,
} from './baseSelectMenuProps.js';

type Option = StringSelectMenuOptionBuilder | SelectMenuComponentOptionData;

const fallbackOption = (id: string) => ({
  label: `fallback-${id}`,
  value: `fallback-${id}`,
});

const MIN_DEFAULT = 0;
const MAX_DEFAULT = 1;

interface StringSelectProps<T>
  extends BaseSelectMenuProps<StringSelectMenuInteraction> {
  id: string;
  of: () => Iterable<T>;
  children: (
    value: T,
    index: Signal<number>,
  ) => JSXElement | StringSelectMenuOptionBuilder;
}

/**
 * String select menu that relies on an array of values.
 */
export function StringSelect<T>(props: StringSelectProps<T>) {
  const id = props.id || getNextUniqueComponentId();

  const selectMenu = new StringSelectMenuBuilder();

  let prevKeyToIndex = new Map<unknown, number>();
  let prevOptions: Option[] = [];
  let prevIndexSetters: Array<Setter<number>> = [];
  let prevDisposals: DisposeFn[] = [];

  const [itemCount, setItemCount] = signal(0);
  const min = computed(() => {
    const count = itemCount();
    const m = read(props.min) ?? MIN_DEFAULT;
    return clamp(m, 0, count);
  });
  const max = computed(() => {
    const count = itemCount();
    const m = read(props.max) ?? MAX_DEFAULT;
    return m === -1 ? count : clamp(m, 1, count);
  });

  const dispose = (key: unknown) => {
    const index = prevKeyToIndex.get(key);
    if (index !== undefined) {
      prevDisposals[index]();
    }
  };

  onCleanup(() => {
    prevDisposals.forEach(dispose);
  });

  patchEffect(() => {
    const items = [...props.of()];
    setItemCount(items.length);
    if (!items.length) {
      prevDisposals.forEach((dispose) => dispose());

      prevKeyToIndex.clear();
      prevOptions.length = 0;
      prevIndexSetters.length = 0;
      prevDisposals.length = 0;

      selectMenu.setOptions([fallbackOption(id)]);
      return;
    }

    const nextIndexSetters: Array<Setter<number>> = [];
    const nextDisposals: DisposeFn[] = [];
    const nextKeyToIndex = new Map<unknown, number>();

    const nextOptions: Option[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // const key = props.keyBy?.(item as any) ?? item;
      const key = item;
      const index = prevKeyToIndex.get(key);
      nextKeyToIndex.set(key, i);

      if (index !== undefined) {
        nextIndexSetters.push(prevIndexSetters[index]);
        nextDisposals.push(prevDisposals[index]);
        nextOptions.push(prevOptions[index]);

        prevIndexSetters[index](i);
        continue;
      }

      const optionOwner = owner<StringSelectMenuOptionBuilder>(() => {
        const [indexSignal, setIndexSignal] = signal(i);
        nextIndexSetters.push(setIndexSignal);
        return flattenToContentNodes(props.children(item, indexSignal));
      });
      const maybeOption = optionOwner.flatten();
      if (maybeOption.length !== 1) {
        throw new Error(
          `Expected a single string select menu option to have been returned for key=${key}. Got ${maybeOption.length}`,
        );
      }

      nextDisposals.push(() => optionOwner.dispose());

      const option = maybeOption[0];
      nextOptions.push(option);
    }

    const prevKeys = new Set(prevKeyToIndex.keys());
    const nextKeys = new Set(nextKeyToIndex.keys());
    const keysToDispose = prevKeys.difference(nextKeys);
    keysToDispose.forEach(dispose);

    prevKeyToIndex = nextKeyToIndex;
    prevOptions = nextOptions;
    prevIndexSetters = nextIndexSetters;
    prevDisposals = nextDisposals;

    selectMenu.setOptions(nextOptions);
  });

  applyPatchEffect(selectMenu, {
    min,
    max,
    placeholder: props.placeholder,
    disabled: () => itemCount() === 0 || !!read(props.disabled),
  });

  return component({
    id,
    component: selectMenu,
    handler: props['on:select'],
  });
}
