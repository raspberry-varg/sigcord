import {
  type APISelectMenuOption,
  type SelectMenuComponentOptionData,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

import {
  type Owner,
  type Setter,
  type Signal,
  ViewManualComputedElementNode,
  ViewNode,
  component,
  computed,
  flatten,
  flattenToContentNodes,
  getNextUniqueComponentId,
  owner,
  read,
  signal,
} from '@sigcord/core';

import type {JSXElement} from '../index.js';
import {clamp} from '../util/clamp.js';
import {
  type BaseSelectMenuProps,
  applyPatchEffect,
} from './baseSelectMenuProps.js';

type OptionObj = SelectMenuComponentOptionData | APISelectMenuOption;

type Option = StringSelectMenuOptionBuilder | OptionObj;

const fallbackOption = (id: string) => ({
  label: `fallback-${id}`,
  value: `fallback-${id}`,
});

const MIN_DEFAULT = 0;
const MAX_DEFAULT = 1;

interface StringSelectProps extends BaseSelectMenuProps<StringSelectMenuInteraction> {
  children: JSXElement | JSXElement[];
}

/**
 * String select menu that relies on an array of values.
 */
export function StringSelect(props: StringSelectProps) {
  // Render content immediately
  let nodes!: readonly ViewNode[];
  const contentOwner = owner(() => {
    nodes = flattenToContentNodes(props.children);
  });

  return new StringSelectNode(props, contentOwner, nodes);
}

class StringSelectNode extends ViewManualComputedElementNode<StringSelectMenuBuilder> {
  private readonly stringSelect: StringSelectMenuBuilder;
  private readonly length: Signal<number>;
  private readonly setLength: Setter<number>;
  private readonly id: string;

  constructor(
    props: StringSelectProps,
    private readonly contentOwner: Owner,
    private readonly nodes: readonly ViewNode[],
  ) {
    super();
    this.id = props.id || getNextUniqueComponentId();
    this.stringSelect = component({
      id: this.id,
      component: new StringSelectMenuBuilder(),
      handler: props['on:select'],
    });

    [this.length, this.setLength] = signal(0);
    const min = computed(() => {
      const count = this.length();
      const m = read(props.min) ?? MIN_DEFAULT;
      return clamp(m, 0, count);
    });
    const max = computed(() => {
      const count = this.length();
      const m = read(props.max) ?? MAX_DEFAULT;
      return m === -1 ? count : clamp(m, 1, count);
    });
    applyPatchEffect(this.stringSelect, {
      min,
      max,
      placeholder: props.placeholder,
      disabled: () => this.length() === 0 || !!read(props.disabled),
    });
  }

  override getFlattened(): StringSelectMenuBuilder {
    const content = flatten(this.nodes, this.contentOwner);
    const updatedOptions: Option[] = [];
    for (let i = 0; i < content.length; i++) {
      const item = content[i];
      if (
        item instanceof StringSelectMenuOptionBuilder ||
        isOptionObjectLike(item)
      ) {
        updatedOptions.push(item);
      } else {
        throw new Error(`Unhandled option type: ${typeof item}`);
      }
    }

    const providedCount = updatedOptions.length;
    const empty = providedCount === 0;
    if (empty) {
      updatedOptions.push(
        new StringSelectMenuOptionBuilder(fallbackOption(this.id)),
      );
    }

    this.stringSelect.setOptions(updatedOptions);
    this.setLength(providedCount);
    return this.stringSelect;
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed_ = true;

    this.contentOwner?.dispose();
    for (let i = 0; i < this.nodes.length; i++) {
      this.nodes[i].dispose();
    }
  }
}

function isOptionObjectLike(val: unknown): val is OptionObj {
  return (
    val != null &&
    typeof val === 'object' &&
    (val as OptionObj).value != null &&
    (val as OptionObj).label != null
  );
}
