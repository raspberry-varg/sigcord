import type { RenderOptions } from './menuInstance.js';

/**
 * @deprecated Please use {@link MenuBuilder} instead.
 */
export interface MenuInstanceActions {
  // render API
  start(options?: Partial<RenderOptions>): Promise<void>;
  reply(options: Omit<Partial<RenderOptions>, 'forceReply'>): Promise<void>;
  // listener API
  onEnd(callback: (reason: string | null) => unknown): void;
  awaitEnd(): Promise<string | null>;
  onTimeout(callback: () => unknown): void;
  awaitTimeout(): Promise<void>;
}
