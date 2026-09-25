import { channelMention, roleMention, time as formatTime, userMention } from 'discord.js';

import { effect, markDirty } from '../../framework/hooks/index.js';
import { read } from '../reactivity/core/read.js';
import { type IntrinsicPropsMap } from '../vdom/index.js';

const TEXT_INTRINSICS = [
  'a',
  'b',
  'br',
  'code',
  'channel',
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
  type: TextIntrinsic,
  props: IntrinsicPropsMap[TextIntrinsic] & { children?: unknown },
): unknown[] {
  const children = !props.children
    ? []
    : Array.isArray(props.children)
      ? props.children
      : [props.children];

  switch (type) {
    case 'br':
      return ['\n'];
    case 'b':
      return ['**', ...children, '**'];
    case 'i':
      return ['*', ...children, '*'];
    case 'u':
      return ['__', ...children, '__'];
    case 'strike':
      return ['~~', ...children, '~~'];
    case 'spoiler':
      return ['||', ...children, '||'];
    case 'h1':
      return ['# ', ...children, '\n'];
    case 'h2':
      return ['## ', ...children, '\n'];
    case 'h3':
      return ['### ', ...children, '\n'];
    case 'sub':
      return ['-# ', ...children, '\n'];
    case 'quote':
      cast<'quote'>(props);
      return [props.block ? '>>> ' : '> ', ...children, '\n'];
    case 'pre':
      return ['`', ...children, '\n```'];
    case 'code':
      cast<'code'>(props);
      return ['```' + (props.language ?? '') + '\n', ...children, '\n```'];
    case 'user':
      cast<'user'>(props);
      return [bindToFormatter(props.id, userMention)];
    case 'role':
      cast<'role'>(props);
      return [bindToFormatter(props.id, roleMention)];
    case 'channel':
      cast<'channel'>(props);
      return [bindToFormatter(props.id, channelMention)];
    case 'a': {
      cast<'a'>(props);
      const url = bindToFormatter(props.url);
      const title = bindToFormatter(props.url);

      const end = title ? [url, ' "', title, '"'] : [url];
      return ['[', ...children, '](', ...end, ')'];
    }
    case 'time': {
      cast<'time'>(props);
      const { time, style } = props;
      if (typeof time !== 'function' && typeof style !== 'function') {
        return [
          formatTime(
            time as Date /* gets really mad with the overloaded types if I leave number in here */,
            style,
          ),
        ];
      }

      let current = '';
      effect(() => {
        const currentTime = read(time);
        const currentStyle = read(style);
        current = formatTime(currentTime as Date, currentStyle);
        markDirty();
      });
      return [() => current];
    }
    default:
      throw new Error(`Unhandled potentially-text intrinsic: ${type satisfies never}`);
  }
}

function cast<K extends keyof IntrinsicPropsMap>(
  _x: IntrinsicPropsMap[keyof IntrinsicPropsMap],
): asserts _x is IntrinsicPropsMap[K] {}

type Formatter = (value: string) => string;
const defaultFormatter: Formatter = (v) => v;

function bindToFormatter(
  prop: unknown,
  formatter: Formatter = defaultFormatter,
): string | (() => string) {
  if (prop == null || prop === false) {
    return '';
  }
  if (typeof prop !== 'function') {
    return formatter(String(prop));
  }

  let current = '';
  effect(() => {
    current = formatter(String(prop()));
    markDirty();
  });
  return () => current;
}
