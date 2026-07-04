import type {
  ButtonBuilder,
  ButtonStyle,
  ComponentEmojiResolvable,
  SeparatorSpacingSize,
  TimestampStylesString,
} from 'discord.js';

import type {
  DeferredComponent,
  MaybeSignal,
  MessageComponentCallbackFor,
  Signal,
  ViewNodeKind,
} from '@sigcord/core';

import {elementFactory} from './jsx-runtime.js';

import JSXNode = JSX.JSXNode;

export type FunctionalComponent = (
  props: Record<string, unknown>,
) => JSX.Element;

export type Attributes = Record<string, JSX.JSXNode | undefined> & JSXChildren;

export {elementFactory} from './elementFactory.js';

export const fragmentFactory = (props: JSXChildren): JSXNode[] => {
  if (!props.children) {
    return [];
  }
  return Array.isArray(props.children) ? props.children : [props.children];
};

export declare namespace JSX {
  interface IntrinsicElements {
    a: AnchorAttributes;
    button: ButtonAttributes;
    separator: SeparatorAttributes;
    text: JSXChildren;
    container: ContainerAttributes;
    section: SectionAttributes;
    row: RowAttributes;
    br: NoChildren;
    b: JSXChildren;
    i: JSXChildren;
    u: JSXChildren;
    pre: JSXChildren;
    sub: JSXChildren;
    h1: JSXChildren;
    h2: JSXChildren;
    h3: JSXChildren;
    strike: JSXChildren;
    spoiler: JSXChildren;
    quote: QuoteAttributes;
    time: TimeAttributes;
    user: UserAttributes;
    role: RoleAttributes;
    channel: ChannelAttributes;
    stringoption: StringSelectOptionAttributes;
  }

  type Element = DeferredComponent<JSXNode> | JSXNode;
  type JSXNode = ViewNodeKind;
}

interface AnchorAttributes {
  title?: MaybeSignal<Primitive>;
  url: MaybeSignal<string>;
  children: JSXNode | JSXNode[];
}

interface ButtonAttributesBase {
  id?: string;
  emoji?: ComponentEmojiResolvable | Signal<ComponentEmojiResolvable>;
  children?: string | Signal<string>;
  disabled?: boolean | Signal<boolean>;
  style: unknown;
  'on:click'?: MessageComponentCallbackFor<'button'>;
}

interface InteractionButton extends ButtonAttributesBase {
  style:
    | Exclude<ButtonStyle, ButtonStyle.Link | ButtonStyle.Premium>
    | Signal<Exclude<ButtonStyle, ButtonStyle.Link | ButtonStyle.Premium>>;
  emoji?: ComponentEmojiResolvable | Signal<ComponentEmojiResolvable>;
}

type ButtonAttributes = InteractionButton;

export interface JSXChildren {
  children?: JSXNode | JSXNode[] | undefined;
}

interface NoChildren {
  children?: never;
}

interface SeparatorAttributes {
  divider?: boolean | Signal<boolean>;
  spacing?: SeparatorSpacingSize | Signal<SeparatorSpacingSize>;
  children?: never;
}

interface ContainerAttributes {
  spoiler?: MaybeSignal<boolean>;
  accent?: MaybeSignal<number | boolean | null | undefined>;
  children: JSXNode | JSXNode[];
}

interface SectionAttributes {
  accessory:
    | JSX.Element
    | MaybeSignal<ButtonBuilder | boolean | null | undefined>;
  children: JSXNode | JSXNode[];
}

interface RowAttributes {
  children: JSXNode | JSXNode[];
}

interface StringSelectOptionAttributes {
  selected?: MaybeSignal<boolean>;
  label: MaybeSignal<string>;
  value: MaybeSignal<string>;
  description?: MaybeSignal<string | null | undefined>;
  emoji?: MaybeSignal<ComponentEmojiResolvable | null | undefined>;
}

interface TimeAttributes {
  style: MaybeSignal<TimestampStylesString>;
  time: MaybeSignal<Date | number>;
}

interface UserAttributes {
  id: MaybeSignal<string>;
}

interface RoleAttributes {
  id: MaybeSignal<string>;
}

interface ChannelAttributes {
  id: MaybeSignal<string>;
  link?: MaybeSignal<boolean>;
}

interface QuoteAttributes extends JSXChildren {
  block?: boolean;
}

export type Primitive = string | number | boolean | null | undefined;

export const jsx = elementFactory;
export const jsxs = elementFactory;
export const jsxDEV = elementFactory;
export const Fragment = fragmentFactory;
