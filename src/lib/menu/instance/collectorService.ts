import {
  ComponentType,
  type CollectedMessageInteraction,
  type Interaction,
  type Message,
} from 'discord.js';
import type { Listener } from '../../../util/Listener.js';
import { logger } from '../../../util/Logger.js';
import type { MessageComponentCallback } from '../../views/viewFlavors.js';
import {
  endReasonIsTimeout,
  type TimeoutEndReason,
} from '../../../util/CollectorUtil.js';

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

interface Listeners {
  onEnd: Listener<TimeoutEndReason | (string & {}) | null>;
  onStop: Listener<string | null>;
  onTimeout: Listener<TimeoutEndReason>;
}

export class CollectorService {
  lastCollected?: CollectedMessageInteraction;
  private collector?: ReturnType<Message['createMessageComponentCollector']>;
  private componentCallbacks: ComponentCallbackMap = new Map();

  constructor(private listeners: Partial<Listeners>) {}

  onComponent(
    componentId: string,
    callback: MessageComponentCallback<any>,
  ): void {
    logger.info('CollectorService: Subscribed to component', {
      id: componentId,
    });
    this.componentCallbacks.set(componentId, callback);
  }

  unsubscribeTo(componentId: string): void {
    logger.info('CollectorService: Unsubscribed from component', {
      id: componentId,
    });
    this.componentCallbacks.delete(componentId);
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
      logger.info('CollectorService: Collected a new interaction.', {
        id: collected.customId,
        type: ComponentType[collected.componentType],
      });
      await onCollect?.(collected);
    });

    collector.on('end', async () => {
      if (!collector) {
        return;
      }
      const endReason = collector.endReason;
      if (endReasonIsTimeout(endReason)) {
        onTimeout();
        this.listeners.onTimeout?.fire(endReason);
      } else {
        this.listeners.onStop?.fire(endReason);
      }
      this.listeners.onEnd?.fire(endReason);
      logger.info(
        `Component listener successfully stopped due to reason: ` + endReason,
      );
    });
  }
}
