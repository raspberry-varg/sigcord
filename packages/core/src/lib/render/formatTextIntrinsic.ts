import {
  HeadingLevel,
  channelLink,
  channelMention,
  heading,
  hyperlink,
  inlineCode,
  italic,
  quote,
  roleMention,
  spoiler,
  strikethrough,
  subtext,
  time,
  underline,
  userMention,
} from 'discord.js';

import { effect, markDirty } from '../../framework/hooks/index.js';
import { parseChildrenToString } from '../../util/parseChildrenToString.js';
import { resolveString } from '../../util/resolveString.js';
import { resolveToConditionalFormatter } from '../../util/resolveToConditionalFormatter.js';
import { read } from '../reactivity/core/read.js';
import { isSignal } from '../reactivity/core/signals.js';
import { type IntrinsicPropsMap } from '../vdom/index.js';

const TEXT_INTRINSICS = [
  'a',
  'channel',
  'br',
  'i',
  'u',
  'pre',
  'sub',
  'h1',
  'h2',
  'h3',
  'strike',
  'spoiler',
  'quote',
  'time',
  'user',
  'role',
] as const satisfies Array<keyof IntrinsicPropsMap>;
type TextIntrinsic = (typeof TEXT_INTRINSICS)[number];
const TEXT_INTRINSIC_SET = new Set<string>(TEXT_INTRINSICS);

export function isTextIntrinsic(type: keyof IntrinsicPropsMap): type is TextIntrinsic {
  return TEXT_INTRINSIC_SET.has(type);
}

export function formatTextIntrinsic(
  type: keyof IntrinsicPropsMap,
  props: IntrinsicPropsMap[keyof IntrinsicPropsMap],
): string | (() => string) {
  switch (type) {
    case 'a': {
      cast<'a'>(props);
      const children = props.children;
      if (!children) {
        return '';
      }

      const displayText = parseChildrenToString(children);

      const title = props.title;
      const url = props.url;

      if (!(isSignal(displayText) || isSignal(url) || isSignal(title))) {
        return hyperlink(displayText, url, resolveString(title));
      }

      let value = '';
      effect(() => {
        markDirty();
        const txt = read(displayText);
        if (!txt) {
          value = '';
          return;
        }

        value = hyperlink(txt, read(url), resolveString(read(title)));
      });
      return () => value;
    }
    case 'channel': {
      cast<'channel'>(props);
      const id = props.id;
      if (typeof id === 'string') {
        if (!id) return '';
        return props.link ? channelLink(id) : channelMention(id);
      }

      let value: string | undefined;
      effect(() => {
        value = id();
        markDirty();
      });

      return () => {
        return !value ? '' : props.link ? channelLink(value) : channelMention(value);
      };
    }
    case 'br':
      cast<'br'>(props);
      return '\n';
    case 'i':
      cast<'i'>(props);
      return resolveToConditionalFormatter(italic, props.children);
    case 'u':
      cast<'u'>(props);
      return resolveToConditionalFormatter(underline, props.children);
    case 'pre':
      cast<'pre'>(props);
      return resolveToConditionalFormatter(inlineCode, props.children);
    case 'sub':
      cast<'sub'>(props);
      return resolveToConditionalFormatter(subtext, props.children, true);
    case 'h1':
      cast<'h1'>(props);
      return resolveToConditionalFormatter(
        (text) => heading(text, HeadingLevel.One),
        props.children,
        true,
      );
    case 'h2':
      cast<'h2'>(props);
      return resolveToConditionalFormatter(
        (text) => heading(text, HeadingLevel.Two),
        props.children,
        true,
      );
    case 'h3':
      cast<'h3'>(props);
      return resolveToConditionalFormatter(
        (text) => heading(text, HeadingLevel.Three),
        props.children,
        true,
      );
    case 'strike':
      cast<'strike'>(props);
      return resolveToConditionalFormatter(strikethrough, props.children, true);
    case 'spoiler':
      cast<'spoiler'>(props);
      return resolveToConditionalFormatter(spoiler, props.children, true);
    case 'quote':
      cast<'quote'>(props);
      return resolveToConditionalFormatter(quote, props.children, true);
    case 'time':
      cast<'time'>(props);
      if (!isSignal(props.time) && !isSignal(props.style)) {
        return time(props.time as Exclude<typeof props.time, Date>, props.style);
      }

      let timestamp = '';
      effect(() => {
        timestamp = time(read(props.time) as number, read(props.style));
      });

      return () => timestamp;
    case 'user': {
      cast<'user'>(props);
      const id = props.id;
      if (typeof id === 'string') {
        return id && userMention(id);
      }

      let value = '';
      effect(() => {
        value = id();
        markDirty();
      });

      return () => {
        return value && userMention(value);
      };
    }
    case 'role': {
      cast<'role'>(props);
      const id = props.id;
      if (typeof id === 'string') {
        return id && roleMention(id);
      }

      let value = '';
      effect(() => {
        value = id();
        markDirty();
      });

      return () => value && roleMention(value);
    }
    default:
      throw new Error(`Unhandled potentially-text intrinsic: ${type}`);
  }
}

function cast<K extends keyof IntrinsicPropsMap>(
  _x: IntrinsicPropsMap[keyof IntrinsicPropsMap],
): asserts _x is IntrinsicPropsMap[K] {}
