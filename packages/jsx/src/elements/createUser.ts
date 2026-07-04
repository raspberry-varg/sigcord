import {userMention} from 'discord.js';

import {computed} from '@sigcord/core';

import {JSX} from '../jsx-runtime.js';

import IntrinsicElements = JSX.IntrinsicElements;

export function createUser(props: IntrinsicElements['user']) {
  const id = props.id;
  if (typeof id === 'string') {
    return id && userMention(id);
  }

  return computed(() => {
    const value = id();
    return value && userMention(value);
  });
}
