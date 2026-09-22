import { channelLink, channelMention, hyperlink, roleMention, userMention } from 'discord.js';

import { effect, markDirty } from '../../framework/hooks/index.js';
import { parseChildrenToString } from '../../util/parseChildrenToString.js';
import { resolveString } from '../../util/resolveString.js';
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
      throw new Error(`Unimplemented text intrinsic: ${type}`);
    case 'i':
      cast<'i'>(props);
      throw new Error(`Unimplemented text intrinsic: ${type}`);
    case 'u':
      cast<'u'>(props);
      throw new Error(`Unimplemented text intrinsic: ${type}`);
    case 'pre':
      cast<'pre'>(props);
      throw new Error(`Unimplemented text intrinsic: ${type}`);
    case 'sub':
      cast<'sub'>(props);
      throw new Error(`Unimplemented text intrinsic: ${type}`);
    case 'h1':
      cast<'h1'>(props);
      throw new Error(`Unimplemented text intrinsic: ${type}`);
    case 'h2':
      cast<'h2'>(props);
      throw new Error(`Unimplemented text intrinsic: ${type}`);
    case 'h3':
      cast<'h3'>(props);
      throw new Error(`Unimplemented text intrinsic: ${type}`);
    case 'strike':
      cast<'strike'>(props);
      throw new Error(`Unimplemented text intrinsic: ${type}`);
    case 'spoiler':
      cast<'spoiler'>(props);
      throw new Error(`Unimplemented text intrinsic: ${type}`);
    case 'quote':
      cast<'quote'>(props);
      throw new Error(`Unimplemented text intrinsic: ${type}`);
    case 'time':
      cast<'time'>(props);
      throw new Error(`Unimplemented text intrinsic: ${type}`);
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
