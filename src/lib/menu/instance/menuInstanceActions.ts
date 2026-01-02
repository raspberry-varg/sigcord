import type { TimeoutEndReason } from '../../../util/CollectorUtil.js';
import type { RenderOptions } from './menuInstance.js';

export interface MenuInstanceActions {
  // render API
  start(options?: Partial<RenderOptions>): Promise<void>;
  reply(options: Omit<Partial<RenderOptions>, 'forceReply'>): Promise<void>;
  // listener API
  onRender(callback: () => unknown, once?: boolean): void;
  awaitRender(): Promise<void>;
  onEnd(
    callback: (endReason: TimeoutEndReason | (string & {}) | null) => unknown,
  ): void;
  awaitEnd(): Promise<TimeoutEndReason | (string & {}) | null>;
  onStop(callback: (endReason: string | null) => unknown): void;
  awaitStop(): Promise<string | null>;
  onTimeout(callback: (timeoutReason: TimeoutEndReason) => unknown): void;
  awaitTimeout(): Promise<TimeoutEndReason | null>;
}
