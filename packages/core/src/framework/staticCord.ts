import type { CordAPI } from './cord.js';

export function isStaticCord(cord: CordAPI): cord is StaticCord {
  return STATIC_CORD_SYMBOL in cord;
}

const STATIC_CORD_SYMBOL: unique symbol = Symbol.for('__sigcord.StaticCord');

export class StaticCord implements CordAPI {
  readonly [STATIC_CORD_SYMBOL] = true;

  private nextComponentId = 0;

  get messageId(): never {
    throw new Error('StaticCord does not support messageId');
  }

  get ephemeral(): never {
    throw new Error('StaticCord does not support ephemeral');
  }

  close(): never {
    throw new Error('StaticCord does not support close');
  }

  createUniqueComponentId(): `__component_${number}` {
    return `__component_${this.nextComponentId++}`;
  }
}
