import type { MessageComponentCallbackFor } from '../components/messageComponentCallback.js';
import type { MaybeSignal, Signal } from '../reactivity/core/signals.js';
import type { ViewNode } from './types.js';
import type {
  AnySelectMenuInteraction,
  ButtonStyle,
  ComponentEmojiResolvable,
  SeparatorSpacingSize,
  StringSelectMenuInteraction,
  TimestampStylesString,
} from 'discord.js';

export type FunctionalComponent = (props: Record<string, unknown>) => ViewNode | ViewNode[];

export type Attributes = Record<string, unknown> & WithChildren;

export interface IntrinsicPropsMap {
  a: AnchorAttributes;
  button: ButtonAttributes;
  separator: SeparatorAttributes;
  text: WithChildren;
  container: ContainerAttributes;
  section: SectionAttributes;
  actionRow: RowAttributes;
  stringSelect: StringSelectAttributes;
  br: NoChildren;
  b: WithChildren;
  i: WithChildren;
  u: WithChildren;
  pre: WithChildren;
  code: CodeAttributes;
  sub: WithChildren;
  h1: WithChildren;
  h2: WithChildren;
  h3: WithChildren;
  strike: WithChildren;
  spoiler: WithChildren;
  quote: QuoteAttributes;
  time: TimeAttributes;
  user: UserAttributes;
  role: RoleAttributes;
  channel: ChannelAttributes;
  stringOption: StringSelectOptionAttributes;
}

export interface AnchorAttributes {
  title?: MaybeSignal<Primitive>;
  url: MaybeSignal<string>;
  children: unknown | unknown[];
}

export interface ButtonAttributesBase {
  id?: string;
  emoji?: ComponentEmojiResolvable | Signal<ComponentEmojiResolvable | undefined>;
  children?: string | Signal<string>;
  disabled?: boolean | Signal<boolean>;
  style: unknown;
  onClick?: MessageComponentCallbackFor<'button'>;
}

export interface InteractionButton extends ButtonAttributesBase {
  style:
    | Exclude<ButtonStyle, ButtonStyle.Link | ButtonStyle.Premium>
    | Signal<Exclude<ButtonStyle, ButtonStyle.Link | ButtonStyle.Premium>>;
  emoji?: ComponentEmojiResolvable | Signal<ComponentEmojiResolvable | undefined>;
}

type ButtonAttributes = InteractionButton;

export interface WithChildren {
  children?: unknown | unknown[] | undefined;
}

export interface NoChildren {
  children?: never;
}

export interface SeparatorAttributes {
  divider?: boolean | Signal<boolean>;
  spacing?: SeparatorSpacingSize | Signal<SeparatorSpacingSize>;
  children?: never;
}

export interface ContainerAttributes {
  spoiler?: MaybeSignal<boolean>;
  accent?: MaybeSignal<number | boolean | null | undefined>;
  children: unknown | unknown[];
}

export interface SectionAttributes {
  accessory: ViewNode | ViewNode[];
  children: unknown | unknown[];
}

export interface RowAttributes {
  children: unknown | unknown[];
}

export interface StringSelectOptionAttributes {
  selected?: MaybeSignal<boolean>;
  label: MaybeSignal<string>;
  /**
   * The value provided to this option.
   *
   * Numbers are coerced to strings, so `'1' === 1`
   */
  value: MaybeSignal<string | number>;
  description?: MaybeSignal<string | null | undefined>;
  emoji?: MaybeSignal<ComponentEmojiResolvable | null | undefined>;
}

export interface TimeAttributes {
  style: MaybeSignal<TimestampStylesString>;
  time: MaybeSignal<Date | number>;
}

export interface UserAttributes {
  id: MaybeSignal<string>;
}

export interface RoleAttributes {
  id: MaybeSignal<string>;
}

export interface ChannelAttributes {
  id: MaybeSignal<string>;
}

export interface QuoteAttributes extends WithChildren {
  block?: boolean;
}

export interface BaseSelectMenuAttributes<Interaction extends AnySelectMenuInteraction> {
  id?: string;
  /**
   * The minimum required number of options the user must select.
   * @default 0
   */
  min?: MaybeSignal<number>;
  /**
   * The minimum required number of options the user can select.
   * @default 1
   */
  max?: MaybeSignal<number>;
  placeholder?: MaybeSignal<string>;
  disabled?: MaybeSignal<boolean>;
  onChange: (select: Interaction) => void;
  children?: unknown;
}

interface StringSelectAttributes extends BaseSelectMenuAttributes<StringSelectMenuInteraction> {
  children: unknown | unknown[];
}

interface CodeAttributes extends WithChildren {
  language?: string;
}

export type Primitive = string | number | boolean | null | undefined;
