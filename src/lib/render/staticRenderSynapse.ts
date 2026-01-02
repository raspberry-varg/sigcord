import type { Synapse } from '../menu/instance/synapse.js';
import { setCurrentSynapse } from '../builtins/builtins.js';
import { createComputed, createSignal } from '../reactivity/core/signals.js';
import { PatchTarget } from '../RenderingEngine.js';
import type { DisposeFn } from './dispose.js';
import { getOpenOwner } from './owner.js';

const noop = (() => {}) as any;

export const STATIC_RENDER_SYNAPSE: Synapse = {
  appendEmbeds: unsupported('appendEmbeds', 'Use a slot instead.'),
  prependEmbeds: unsupported('prependEmbeds', 'Use a slot instead.'),
  appendComponents: unsupported('appendComponents', 'Use a slot instead.'),
  prependComponents: unsupported('prependComponents', 'Use a slot instead.'),
  awaitModalSubmit: unsupported('awaitModalSubmit'),
  close: noop,
  component(definition) {
    if (definition.id) {
      definition.component.setCustomId(definition.id);
    }
    return definition.component;
  },
  createComputed(fn) {
    return createComputed(fn);
  },
  createSignal<T>(fnOrValue: T | undefined = undefined) {
    return createSignal(fnOrValue, PatchTarget.None).split();
  },
  createWritableSignal<T>(initialValue: T | undefined = undefined) {
    const s = createSignal(initialValue, PatchTarget.None);
    return s;
  },
  createEffect: (fn) => staticEffect(fn),
  goTo: unsupported('goTo'),
  goBack: unsupported('goBack'),
  canGoBack() {
    return false;
  },
  onResume: noop,
  onSuspend: noop,
  getMenuInfo: unsupported('getMenuInfo'),
  scheduleUpdate: unsupported('doUpdate'),
  onModalSubmit: unsupported('onModalSubmit'),
  addPatchTargets: noop,
  setIdleMs: noop,
  setIdleSec: noop,
  showModal: unsupported('showModal'),
  stop: noop,
  swap: unsupported('swap'),
  get ctx(): any {
    unsupported('ctx')();
    return undefined;
  },
  deferUpdate: noop,
  getNextUniqueComponentId: unsupported('getNextUniqueComponentId'),
};

function unsupported(feature: string, reason?: string) {
  return () => {
    throw new Error(
      `Static render does not support '${feature}'.` +
        (reason ? ` ${reason}` : ''),
    );
  };
}

function staticEffect(fn: () => void | DisposeFn): DisposeFn {
  function menuEffect(): void | DisposeFn {
    let dispose;
    const prevContext = setCurrentSynapse(STATIC_RENDER_SYNAPSE);
    try {
      dispose = fn();
    } finally {
      setCurrentSynapse(prevContext);
    }

    return dispose;
  }

  const currentOwner = getOpenOwner();
  const dispose = menuEffect();
  if (dispose) {
    if (!currentOwner) {
      throw new Error(
        'Effect provides a disposal, but no owner was found. ' +
          'Hanging disposals cannot be resolved in a static render context.',
      );
    }
    currentOwner.registerDisposal(dispose);
  }
  return () => dispose?.();
}
