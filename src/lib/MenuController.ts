import type {
  EmbedBuilder,
  CollectedMessageInteraction,
  InteractionCollector,
  MessageComponentInteraction,
  RepliableInteraction,
  Message,
} from 'discord.js';
import {
  View,
  Synapse,
  ViewInstance,
  ViewProps,
  instantiateViewFromClosure,
  MenuContext,
} from './FunctionalMenuView';
import { IntrinsicMenuProps } from './InteractiveMenu';
import { appendTimeoutEmbed, safeRender } from '../util/RenderingUtil';
import { endReasonIsTimeout } from '../util/CollectorUtil';
import { SmartComponentType } from './SmartComponents';
import { assert, assertAndReturn } from '../util/Assertions';
import { Listener } from './Listener';
import { logger } from '../util/Logger';

export interface ControllerContext {
  // onLoadCallbacks: OnLoadCallback[];
  appendedEmbeds: EmbedBuilder[];
  prependedEmbeds: EmbedBuilder[];
  smartComponents: Map<string, { component: any; callback: any }>;
  queuedViewChange: string | null;
}

export interface MessageComponentCallback<
  T extends MessageComponentInteraction = MessageComponentInteraction
> {
  (callback: T): Promise<unknown> | unknown;
}

export interface RenderOptions<ViewIds extends string = string> {
  /**
   * Reply or followup instead of editing or updating the original message.
   * @default false
   */
  forceReply: boolean | false;
  view?: ViewIds;
}

const DefaultRenderOptions: RenderOptions = {
  forceReply: false,
} as const;

const DEFAULT_IDLE = 60_000;

const DefaultProperties: IntrinsicMenuProps = {
  renderAfterHandledInteraction: true,
  idleTimeMs: DEFAULT_IDLE,
  ephemeral: false,
};

type MenuViewComponentId = string;

interface MenuControllerListeners {
  onRender: Listener<void>;
  onEnd: Listener<string | null>;
}

export function MenuController<
  MenuProps extends NonNullable<unknown> = NonNullable<unknown>,
  ViewId extends string = string
>(
  menuId: string,
  initialViewId: string,
  registeredViews: View[],
  interaction: RepliableInteraction,
  initProps: MenuProps
) {
  const listeners: MenuControllerListeners = {
    onRender: new Listener(),
    onEnd: new Listener(),
  };
  const ctx: MenuContext = {
    interaction,
    initialInteraction: interaction,
    get idleTimeMs(): number {
      return idle;
    },
  };
  const builtins: Synapse = {
    ctx,
    appendEmbeds: (...embeds: EmbedBuilder[]) => appendedEmbeds.push(...embeds),
    prependEmbeds: (...embeds: EmbedBuilder[]) =>
      prependedEmbeds.push(...embeds),
    swap: (id: string, ...args: any[]) => changeViewWithCallback(id, ...args),
    component: ({ id, component, controller }) => {
      const componentId = createComponentId(id);
      component.setCustomId(componentId);
      componentCallbacks.set(componentId, controller);
      return component;
    },
    showModal: async (interaction, modal) => {
      latestModal.customId = modal.data.custom_id ?? '';
      return await interaction.showModal(modal);
    },
    awaitModalSubmit: async (interaction, options) => {
      latestModal.interactionId = interaction.id;
      const response = await interaction.awaitModalSubmit(options).catch(() => {
        logger.debug('Modal ended without receiving a response.');
        flushModal();
        return null;
      });
      if (
        !response ||
        (latestModal.interactionId.length &&
          latestModal.interactionId !== interaction.id) ||
        (latestModal.customId.length &&
          latestModal.customId !== response.customId)
      ) {
        return null;
      }
      flushModal();
      return response;
    },
    onModalSubmit: async (interaction, options, callback) => {
      latestModal.interactionId = interaction.id;
      const response = await interaction.awaitModalSubmit(options).catch(() => {
        logger.debug('Modal ended without receiving a response.');
        flushModal();
        return;
      });
      if (
        !response ||
        latestModal.interactionId !== interaction.id ||
        latestModal.customId !== response.customId
      ) {
        return;
      }
      flushModal();
      await callback(response);
    },
    setIdleMs: (idleMilliseconds: number) => {
      assert(
        idleMilliseconds > 0,
        `Idle time must be greater than 0 milliseconds, got [${idleMilliseconds}].`
      );
      updateListenerIdle(idleMilliseconds);
    },
    setIdleSec: (idleSeconds: number) => {
      assert(
        idleSeconds > 0,
        `Idle time must be greater than 0 seconds, got [${idleSeconds}].`
      );
      updateListenerIdle(idleSeconds * 1_000);
    },
    close: () => closeMenu(),
    skipRender: (shouldSkip = true) => {
      skipRender = shouldSkip;
    },
    stop: (reason?: string) => endListener(reason),
  };
  const props = buildProps(initProps, builtins);
  const views = new Map<string, View>(registeredViews.map((v) => [v.id, v]));
  const closureViewsCache = new Map<string, ViewInstance>();
  const componentCallbacks = new Map<
    MenuViewComponentId,
    MessageComponentCallback<any>
  >();
  const renderedViews = new Set<View>();
  const appendedEmbeds: EmbedBuilder[] = [];
  const prependedEmbeds: EmbedBuilder[] = [];

  let idle: number =
    props.idleTimeMs === undefined
      ? DEFAULT_IDLE
      : assertAndReturn(
          props.idleTimeMs,
          (t) => t > 0,
          `Idle time must be greater than 0 milliseconds, got [${props.idleTimeMs}].`
        );
  let view: ViewInstance;
  let message: Message;
  let collector: InteractionCollector<CollectedMessageInteraction> | null =
    null;
  let latestInteractionCollected: CollectedMessageInteraction | null = null;
  const latestModal = {
    interactionId: '',
    customId: '',
  };
  let skipRender = false;

  function shouldRerender() {
    return skipRender === false;
  }

  function afterRender() {
    skipRender = false;
    listeners.onRender.fire();
  }

  function createComponentId(componentId: string): MenuViewComponentId {
    if (componentId.includes(':')) {
      throw new MenuViewComponentError(
        `Internal delimiter uses ':' for MenuViewComponentIds. Please use ` +
          `a different character.`
      );
    }
    return `${menuId}:${view.id}:${componentId}`;
  }

  function clearViewArtifacts() {
    componentCallbacks.clear();
    flushModal();
  }

  function flushModal() {
    latestModal.customId = '';
    latestModal.interactionId = '';
  }

  async function getView(id: string): Promise<ViewInstance> {
    const view = views.get(id);
    assert(view, `"${id}" is not a registered view.`);
    let viewInstance: ViewInstance;
    if (!('closure' in view)) {
      viewInstance = view;
    } else {
      // try cache for instantiated view
      if (!closureViewsCache.has(id)) {
        closureViewsCache.set(
          id,
          // eslint-disable-next-line @typescript-eslint/ban-types
          await instantiateViewFromClosure<{}>(view, props)
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      viewInstance = closureViewsCache.get(id)!;
    }
    return viewInstance;
  }

  async function changeView(id: string) {
    assert(
      !(view !== undefined && id === view.id),
      `Cannot swap to the same view; already in view "${id}"`
    );
    view = await getView(id);
    clearViewArtifacts();
  }

  async function changeViewWithCallback(id: string, ...args: any[]) {
    await changeView(id);
    await view.onSwap?.(...args);
  }

  /**
   * Close the Menu and end component listener.
   * - This will also delete ephemeral replies.
   */
  function closeMenu() {
    return endListener('close');
  }

  function endListener(reason?: string) {
    return collector?.stop(reason);
  }

  function getComponentId(rawCustomId: string) {
    const componentIdSplit = rawCustomId.split(':');
    if (componentIdSplit.length !== 3) {
      throw new MenuViewComponentError(
        `customId for '${rawCustomId}' is malformed. Please use ` +
          `'createMessageComponentId()' when defining a new component id.`
      );
    }
    return componentIdSplit.at(-1);
  }

  // TODO: Move collector into a microservice outside of this file.
  function initCollector() {
    assert(message, `Unable to initialize collectors; 'message' is undefined.`);

    collector = message.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === interaction.user.id &&
        i.channelId === interaction.channelId,
      idle,
    });

    collector.on('collect', async (collected) => {
      await onCollect(collected);
    });

    collector.on('end', async (collected) => {
      if (!collector) {
        return;
      }

      const endReason = collector.endReason;
      listeners.onEnd.fire(endReason);
      logger.debug(
        `${menuId} component listener successfully stopped due to reason: ` +
          endReason
      );

      if (collector.endReason === 'close') {
        // prevent re-render and delete the original interaction's reply
        props.renderAfterHandledInteraction = false;
        interaction.deleteReply(message).catch((e) => {
          logger.error(
            `Unable to delete the original interaction reply for menuId [${menuId}]: `,
            e
          );
        });
        return;
      }

      if (collected.size < 1 || endReasonIsTimeout(endReason)) {
        await render();
        return;
      }
    });
  }

  function updateListenerIdle(timeMilliseconds: number): void {
    if (collector && !collector.ended) {
      idle = timeMilliseconds;
      collector.resetTimer({ time: timeMilliseconds });
    }
  }

  function handlePrebuiltComponents(collected: CollectedMessageInteraction) {
    const id = collected.customId;
    if (collected.isButton()) {
      switch (id) {
        case SmartComponentType.CloseButton: {
          logger.debug('Closing Menu via official CloseMenuButton');
          closeMenu();
          return true;
        }
      }
    }
    return false;
  }

  async function onCollect(collected: CollectedMessageInteraction) {
    latestInteractionCollected = collected;

    if (handlePrebuiltComponents(collected)) {
      return;
    }

    // route to registered handler
    const interactionCallback = componentCallbacks.get(collected.customId);
    if (!interactionCallback) {
      logger.warn(
        `MenuView: No handler defined for ${getComponentId(collected.customId)}`
      );
      return 'No handler defined.';
    }
    const currentView = view;
    await interactionCallback(collected);

    if (view === currentView && props.renderAfterHandledInteraction) {
      await render();
    }
  }

  /**
   * Force a reply to the initial interaction instead of dynamically rendering.
   */
  async function reply(
    options: Omit<Partial<RenderOptions<ViewId>>, 'forceReply'>
  ) {
    return await render({ ...options, forceReply: true });
  }

  /**
   * Render the currently-active view to the original interaction.
   */
  async function render(options?: Partial<RenderOptions<ViewId>>) {
    if (!shouldRerender()) {
      logger.debug('Re-render has been skipped.', { menuId, viewId: view.id });
      return;
    }
    const o = { ...DefaultRenderOptions, ...options };
    if (o.view) {
      // change initial view
      await changeView(o.view);
    }
    if (view === undefined) {
      await changeView(initialViewId);
    }
    // if subview, ensure `onSwap` has been called at least once
    assert(
      !view.isSubView || renderedViews.has(view),
      `Tried to render subview "${view.id}" directly. ` +
        'Subviews must be swapped into.'
    );

    const collectorEnded = collector?.ended;
    const endReason = collector?.endReason;
    let renderTarget = interaction;

    /**
     * If rendering after each collected interaction, swap render target to
     * latest collected
     */
    if (props.renderAfterHandledInteraction && latestInteractionCollected) {
      renderTarget = latestInteractionCollected;
    }
    ctx.interaction = renderTarget;

    let viewPayload = await view.render(props);
    renderedViews.add(view);
    if (collectorEnded) {
      if (endReasonIsTimeout(endReason)) {
        viewPayload = appendTimeoutEmbed({ ...props, ...viewPayload });
        viewPayload.components = [];
      }
      return;
    }

    if (appendedEmbeds.length || prependedEmbeds.length) {
      viewPayload.embeds = [
        ...prependedEmbeds,
        ...(viewPayload.embeds ?? []),
        ...appendedEmbeds,
      ];
      prependedEmbeds.length = 0;
      appendedEmbeds.length = 0;
    }

    message = await safeRender(
      renderTarget,
      { ...props, ...viewPayload },
      o.forceReply
    );
    afterRender();

    if (!collector) {
      initCollector();
    }
  }

  /*
   * Listener API
   */
  function onRender(callback: () => unknown, once = false): void {
    listeners.onRender.do(callback, once);
  }
  function onEnd(callback: (endReason: string | null) => unknown): void {
    listeners.onEnd.do(callback);
  }
  const awaitRender = () => listeners.onRender.asPromise();
  const awaitEnd = () => listeners.onEnd.asPromise();

  return {
    // render API
    reply,
    render,
    // listener API
    onRender,
    awaitRender,
    onEnd,
    awaitEnd,
  };
}

function buildProps<Props extends NonNullable<unknown>>(
  initProps: Props,
  builtins: Synapse
): ViewProps<Props> & IntrinsicMenuProps {
  return {
    ...DefaultProperties,
    ...initProps,
    $: builtins,
  };
}

class MenuViewComponentError extends Error {
  constructor(message: string) {
    super(message);
  }
}
