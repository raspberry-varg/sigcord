import { computed } from '../core/primitives/index.js';
import { isSignal, type MaybeSignal } from '../lib/reactivity/core/signals.js';

export function tryPromoteToSignal<T>(value: MaybeSignal<T>): MaybeSignal<T> {
  if (isSignal(value)) {
    return value;
  }
  if (typeof value === 'function') {
    return computed(() => value());
  }
  return value;
}
