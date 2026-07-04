import {type MaybeSignal, computed, isSignal} from '@sigcord/core';

export function tryPromoteToSignal<T>(value: MaybeSignal<T>): MaybeSignal<T> {
  if (isSignal(value)) {
    return value;
  }
  if (typeof value === 'function') {
    return computed(() => value());
  }
  return value;
}
