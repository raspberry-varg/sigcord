import {channelLink, channelMention} from 'discord.js';

import {computed} from '@sigcord/core';

import type {IntrinsicElementProps} from '../index.js';

export function createChannel(props: IntrinsicElementProps['channel']) {
  const id = props.id;
  if (typeof id === 'string') {
    if (!id) return '';
    return props.link ? channelLink(id) : channelMention(id);
  }

  return computed(() => {
    const value = id();
    if (!value) return '';
    return props.link ? channelLink(value) : channelMention(value);
  });
}
