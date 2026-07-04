import {HeadingLevel} from 'discord.js';

import {DeferredComponent} from '@sigcord/core';

import {createAnchor} from './elements/createAnchor.js';
import {createBold} from './elements/createBold.js';
import {createButton} from './elements/createButton.js';
import {createChannel} from './elements/createChannel.js';
import {createContainer} from './elements/createContainer.js';
import {createHeading} from './elements/createHeading.js';
import {createInlineCode} from './elements/createInlineCode.js';
import {createItalic} from './elements/createItalic.js';
import {createQuote} from './elements/createQuote.js';
import {createRole} from './elements/createRole.js';
import {createRow} from './elements/createRow.js';
import {createSection} from './elements/createSection.js';
import {createSeparator} from './elements/createSeparator.js';
import {createSpoiler} from './elements/createSpoiler.js';
import {createStrikethrough} from './elements/createStrikethrough.js';
import {createStringSelectOption} from './elements/createStringSelectOption.js';
import {createSubtext} from './elements/createSubtext.js';
import {createTextDisplay} from './elements/createTextDisplay.js';
import {createTime} from './elements/createTime.js';
import {createUnderline} from './elements/createUnderline.js';
import {createUser} from './elements/createUser.js';
import {type IntrinsicElementProps, JSXElement} from './index.js';
import {type Attributes, type FunctionalComponent, JSX} from './jsx-runtime.js';

import IntrinsicElements = JSX.IntrinsicElements;

export function elementFactory<
  T extends string | FunctionalComponent | undefined,
>(tagName: T, props: Attributes): JSXElement | JSXElement[] {
  if (typeof tagName === 'function') {
    return new DeferredComponent(tagName, props);
  }

  if (tagName === undefined) {
    // Fragment
    const children = props.children;
    return !children ? [] : children;
  }

  const tag = tagName as keyof IntrinsicElements;
  const factory = getFactory(tag) as (p: typeof props) => JSX.JSXNode;
  if (EAGER_FACTORIES.has(tag)) {
    return factory(props);
  }

  return new DeferredComponent(factory, props);
}

type FactoryRecord = {
  [x in keyof IntrinsicElements]: (
    props: IntrinsicElementProps[x],
  ) => JSX.JSXNode;
};

const EAGER_FACTORIES = new Set<keyof IntrinsicElements>([
  'a',
  'br',
  'b',
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
  'channel',
]);

const INTRINSIC_FACTORIES = {
  a: createAnchor,
  button: createButton,
  separator: createSeparator,
  text: createTextDisplay,
  container: createContainer,
  section: createSection,
  row: createRow,
  stringoption: createStringSelectOption,
  br: () => '\n',
  b: createBold,
  i: createItalic,
  u: createUnderline,
  pre: createInlineCode,
  sub: createSubtext,
  h1: (p) => createHeading(p, HeadingLevel.One),
  h2: (p) => createHeading(p, HeadingLevel.Two),
  h3: (p) => createHeading(p, HeadingLevel.Three),
  strike: createStrikethrough,
  spoiler: createSpoiler,
  quote: createQuote,
  time: createTime,
  user: createUser,
  role: createRole,
  channel: createChannel,
} as const satisfies FactoryRecord;

function getFactory<T extends keyof IntrinsicElements>(
  tag: T,
): (typeof INTRINSIC_FACTORIES)[T] {
  return INTRINSIC_FACTORIES[tag];
}
