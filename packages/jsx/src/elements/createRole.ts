import {roleMention} from 'discord.js';

import {computed} from '@sigcord/core';

import {JSX} from '../jsx-runtime.js';

import IntrinsicElements = JSX.IntrinsicElements;

export function createRole(props: IntrinsicElements['role']) {
  const id = props.id;
  if (typeof id === 'string') {
    return id && roleMention(id);
  }

  return computed(() => {
    const value = id();
    return value && roleMention(value);
  });
}
