import {blockQuote, quote} from 'discord.js';

import type {IntrinsicElementProps} from '../index.js';
import {resolveToConditionalFormatter} from '../util/resolveToConditionalFormatter.js';

export function createQuote(props: IntrinsicElementProps['quote']) {
  return resolveToConditionalFormatter(
    props.block ? blockQuote : quote,
    props.children,
    true,
  );
}
