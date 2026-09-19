import {time} from 'discord.js';

import {computed, isSignal, read} from '@sigcord/core';

import type {IntrinsicElementProps} from '../index.js';

export function createTime(props: IntrinsicElementProps['time']) {
  if (!isSignal(props.time) && !isSignal(props.style)) {
    return time(props.time as Exclude<typeof props.time, Date>, props.style);
  }

  return computed(() => time(read(props.time) as number, read(props.style)));
}
