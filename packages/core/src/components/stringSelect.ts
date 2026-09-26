import { h, type IntrinsicPropsMap } from '../lib/vdom/index.js';

/**
 * @deprecated Use the intrinsic <stringSelect> tag instead.
 * String select menu that relies on an array of values.
 */
export function StringSelect(props: IntrinsicPropsMap['stringSelect']) {
  return h('stringSelect', props);
}
