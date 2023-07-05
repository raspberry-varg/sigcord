import type {
  CollectedMessageInteraction,
  InteractionCollector,
  Message,
  RepliableInteraction,
} from 'discord.js';
import type { MenuView } from './MenuView';
import { Router } from './Router';
import { SmartComponentType } from './SmartComponents';
import { endReasonIsTimeout } from '../util/CollectorUtil';
import { appendTimeoutEmbed, safeRender } from '../util/RenderingUtil';

const DEFAULT_IDLE = 60_000;

interface InteractiveMenuOptions {
  /**
   * If a Message Component, reply to it instead of updating on first render.
   */
  replyToComponentOnFirstRender: boolean;
  ephemeral: boolean;
}
export interface InteractiveMenuInitOptions
  extends Partial<InteractiveMenuOptions> {
  /**
   * Existing message to listen for components from.
   */
  message?: Message;
}

export abstract class InteractiveMenu {
  abstract id: string;
  protected message?: Message;
  protected readonly router: Router;
  protected readonly options: InteractiveMenuOptions;
  protected readonly idleTimeMs?: number;
  private collector?: InteractionCollector<CollectedMessageInteraction>;
  private latestInteractionCollected?: CollectedMessageInteraction;
  private readonly registeredViews: Map<string, MenuView>;
  /**
   * Whether or not to call {@link render render()} after each Collected Message
   * Component is successfully handled.
   * - {@link render()} is called when the listener handler defined in
   *   {@link onCollect()} resolves its Promise (I.E. returns from the
   *   asynchronous function or resolves a returned Promise).
   */
  abstract renderAfterHandledInteraction: boolean;

  constructor(
    protected activeView: string,
    readonly interaction: RepliableInteraction,
    menuOptions: InteractiveMenuInitOptions = {}
  ) {
    this.registeredViews = new Map();
    this.router = new Router(this);
    this.message = menuOptions.message;
    this.options = {
      ephemeral: menuOptions.ephemeral ?? false,
      replyToComponentOnFirstRender:
        menuOptions.replyToComponentOnFirstRender ?? false,
    };
  }

  /** Swap the current displayed view. */
  swapView(viewId: string) {
    this.activeView = viewId;
  }

  /** Get the current collector idle time before close in seconds. */
  idleTimeSeconds() {
    return Math.round((this.idleTimeMs ?? DEFAULT_IDLE) / 1_000);
  }

  /**
   * Close the Menu and end component listener.
   * - This will also delete ephemeral replies.
   */
  closeMenu() {
    return this.endListener('close');
  }

  /** Render the currently-active view to the original interaction. */
  async render() {
    const view = this.getCurrentView();
    const collectorEnded = this.collector?.ended;
    const endReason = this.collector?.endReason;
    let renderTarget = this.interaction;

    /**
     * If rendering after each collected interaction, swap render target to
     * latest collected
     */
    if (this.renderAfterHandledInteraction && this.latestInteractionCollected) {
      renderTarget = this.latestInteractionCollected;
    }

    if (!collectorEnded) {
      await view.triggerPreloads();
    }

    const viewPayload = view.messagePayload();
    if (collectorEnded) {
      appendTimeoutEmbed(viewPayload, endReason);
    }

    this.message = await safeRender(
      renderTarget,
      viewPayload,
      this.options.replyToComponentOnFirstRender
    );
    this.options.replyToComponentOnFirstRender = false;

    if (!this.collector) {
      this.initCollector();
    }
  }

  /** End the listener with a given reason, ending interactivity as a result. */
  protected endListener(reason?: string) {
    return this.collector?.stop(reason);
  }

  /** Register a MenuView to the menu. */
  protected registerView(view: MenuView) {
    this.registeredViews.set(view.id, view);
  }

  private getCurrentView() {
    if (this.registeredViews.size < 1) {
      throw new InteractiveMenuError(
        `There are no registered views in this InteractiveMenu. Use ` +
          `'registerView()' on each of your MenuViews.`
      );
    }
    const currentView = this.registeredViews.get(this.activeView);
    if (!currentView) {
      throw new InteractiveMenuError(
        `'${currentView}' is not a registered view in InteractiveMenu ` +
          `${this.id}. Ensure you use 'registerView()' on each of your ` +
          `MenuViews.`
      );
    }
    return currentView;
  }

  private initCollector() {
    if (!this.message) {
      throw new InteractiveMenuError(`'message' is undefined.`);
    }

    this.collector = this.message.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === this.interaction.user.id &&
        i.channelId === this.interaction.channelId,
      idle: this.idleTimeMs ?? DEFAULT_IDLE,
    });

    this.collector.on('collect', async (collected) => {
      collected.deferUpdate();
      await this.onCollect(collected);
    });

    this.collector.on('end', async (collected) => {
      if (!this.collector) {
        return;
      }

      const endReason = this.collector.endReason;
      console.log(
        `${this.id} component listener successfully stopped due to reason: ` +
          endReason
      );
      if (collected.size < 1 || endReasonIsTimeout(endReason)) {
        await this.render();
        return;
      }

      if (this.collector?.endReason === 'close') {
        // prevent re-render and delete the original interaction's reply
        this.renderAfterHandledInteraction = false;
        this.interaction.deleteReply(this.message).catch((e) => {
          console.log(e);
        });
        return;
      }
    });
  }

  private handlePrebuiltComponents(collected: CollectedMessageInteraction) {
    const id = collected.customId;
    if (collected.isButton()) {
      switch (id) {
        case SmartComponentType.CloseButton: {
          console.log('Closing Menu via official CloseMenuButton');
          this.closeMenu();
          return true;
        }
      }
    }
    return false;
  }

  private async onCollect(collected: CollectedMessageInteraction) {
    this.latestInteractionCollected = collected;

    if (this.handlePrebuiltComponents(collected)) {
      return;
    }

    await this.getCurrentView()._passCollectedInteractionToHandler(collected);

    if (this.renderAfterHandledInteraction) {
      await this.render();
    }
  }
}

class InteractiveMenuError extends Error {
  constructor(message: string) {
    super(message);
  }
}
