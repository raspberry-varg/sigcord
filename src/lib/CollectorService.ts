import type {
  CollectedMessageInteraction,
  Interaction,
  Message,
} from 'discord.js';
import type { Listener } from './Listener.js';
import { logger } from '../util/Logger.js';
import type { MessageComponentCallback } from './MenuView.js';
import { endReasonIsTimeout } from '../util/CollectorUtil.js';

type ComponentId = string;
type ComponentCallbackMap = Map<ComponentId, MessageComponentCallback<any>>;
type OnCollectCallback = (
  collected: CollectedMessageInteraction,
) => void | Promise<void>;

interface CollectorOptions {
  onTimeout: () => void;
  filter: (interaction: Interaction) => boolean;
  idle: number;
  message: Message;
  onCollect: OnCollectCallback;
}

export class CollectorService {
  lastCollected?: CollectedMessageInteraction;
  private collector?: ReturnType<Message['createMessageComponentCollector']>;
  private listeners: Listener<string | null>;
  private componentCallbacks: ComponentCallbackMap = new Map();

  constructor(onEndListener: Listener<string | null>) {
    this.listeners = onEndListener;
  }

  onComponent(
    componentId: string,
    callback: MessageComponentCallback<any>,
  ): void {
    this.componentCallbacks.set(componentId, callback);
  }

  getComponentCallback(componentId: string) {
    return this.componentCallbacks.get(componentId);
  }

  clear(): void {
    this.componentCallbacks.clear();
  }

  updateIdle(timeMilliseconds: number): void {
    if (!this.collector || this.hasEnded()) {
      return;
    }
    this.collector.resetTimer({ time: timeMilliseconds });
  }

  stop(reason?: string) {
    this.collector?.stop(reason);
  }

  hasEnded(): boolean {
    return !this.collector || this.collector.ended;
  }

  init({
    message,
    idle,
    filter,
    onTimeout,
    onCollect,
  }: CollectorOptions): void {
    const collector = (this.collector = message.createMessageComponentCollector(
      {
        filter,
        idle,
      },
    ));

    collector.on('collect', async (collected) => {
      this.lastCollected = collected;
      await onCollect?.(collected);
    });

    collector.on('end', async () => {
      if (!collector) {
        return;
      }
      const endReason = collector.endReason;
      if (endReasonIsTimeout(endReason)) {
        onTimeout();
      }
      this.listeners.fire(endReason);
      logger.debug(
        `Component listener successfully stopped due to reason: ` + endReason,
      );
    });
  }
}
