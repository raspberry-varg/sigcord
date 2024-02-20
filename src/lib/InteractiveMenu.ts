import type {
  CollectedMessageInteraction,
  InteractionCollector,
  Message,
  RepliableInteraction,
} from 'discord.js';
import type { IntrinsicViewProps, MenuView } from './MenuView';
import { Router } from './Router';
import { SmartComponentType } from './SmartComponents';
import { endReasonIsTimeout } from '../util/CollectorUtil';
import { appendTimeoutEmbed, safeRender } from '../util/RenderingUtil';

const DEFAULT_IDLE = 60_000;

export interface IntrinsicMenuProps extends IntrinsicViewProps {
  /**
   * When a message component is handled, call {@link render()}.
   * @default true
   */
  renderAfterHandledInteraction: boolean | true;
  /**
   * Make this menu render its views as a private message.
   * @default false
   */
  ephemeral: boolean | false;
  /**
   * Existing message to listen for components from.
   */
  initialMessage?: Message;
}

const DefaultProperties: IntrinsicMenuProps = {
  renderAfterHandledInteraction: true,
  ephemeral: false,
};

type ViewConstructor = new (props: any) => MenuView;
type ViewArrayDefinitions = ViewConstructor[];
type ViewRecordDefinitions = Record<string, unknown> & Record<string, ViewConstructor>;
type ViewDefinitions = ViewArrayDefinitions | ViewRecordDefinitions;

type AllPropertiesOfRecord<Views extends ViewRecordDefinitions> = {
  [KView in keyof Views]: {
    [KProp in keyof ConstructorParameters<Views[KView]>]: ConstructorParameters<Views[KView]>[KProp]
  }[keyof ConstructorParameters<Views[KView]>]
}[keyof Views];
type AllPropertiesOfArray<Views extends ViewArrayDefinitions> = {
  [KView in keyof Views]: {
    [KProp in keyof ConstructorParameters<Views[KView]>]: ConstructorParameters<Views[KView]>[KProp]
  }[keyof ConstructorParameters<Views[KView]>]
}[keyof Views];

type AllPropertiesOf<Views extends ViewDefinitions> = Views extends ViewArrayDefinitions
  ? AllPropertiesOfArray<Views>
  : Views extends ViewRecordDefinitions
  ? AllPropertiesOfRecord<Views>
  : never;

/**
 * Define an interactive menu functionally.
 * @param id The unique ID of this menu. Used in component `customId`s.
 * @param views All views that this menu utilizes.
 * @param initialView The view that should be rendered first.
 * @param intrinsic Override default values for intrinsic properties.
 */
export function DefineMenu<
  Views extends ViewDefinitions,
  Props extends AllPropertiesOf<Views> & Partial<IntrinsicMenuProps>,
>({
  id,
  initialView,
  views,
  intrinsic,
}: {
  id: string;
  initialView: Views extends ViewArrayDefinitions ? string : keyof Views;
  views: Views;
  intrinsic?: Partial<IntrinsicMenuProps>;
}) {
  // check if initial view is valid
  const idToClass = new Map<string, ViewConstructor>();
  if (Array.isArray(views)) {
    // convert array to map of id to view class
    for (const view of views) {
      // quick initialization to get the user-defined id
      const id = new view({}).id;
      if (idToClass.has(id)) {
        throw new InteractiveMenuError(`Id '${id}' already exists in this interactive menu.`);
      }
      idToClass.set(id, view);
    }
  } else {
    // remap record key-value pairs into map
    for (const [id, view] of Object.entries(views)) {
      if (idToClass.has(id)) {
        throw new InteractiveMenuError(`Id '${id}' already exists in this interactive menu.`);
      }
      idToClass.set(id, view);
    }
  }
  if (!idToClass.has(initialView)) {
    throw new InteractiveMenuError(
      `Initial view ID: "${initialView}" is not a registered view.`
    );
  }

  // constructor callback
  return (interaction: RepliableInteraction, props: Props) => {
    // construct menu
    const menu = new InteractiveMenu(initialView, interaction, { ...intrinsic, ...props });
    menu.id = id;
    for (const [id, view] of idToClass.entries()) {
      menu.registerView(id, view);
    }
    return menu;
  };
}

export class InteractiveMenu<
  MenuProps extends NonNullable<unknown> = NonNullable<unknown>
> {
  id: string = this.constructor.name;
  protected message?: Message;
  protected activeView: string;
  protected readonly router: Router;
  protected readonly idleTimeMs?: number;
  protected props: MenuProps & IntrinsicMenuProps;
  private collector?: InteractionCollector<CollectedMessageInteraction>;
  private latestInteractionCollected?: CollectedMessageInteraction;
  private readonly registeredViews: Map<string, typeof MenuView<any>>;
  private readonly cachedViews: Map<string, MenuView>;

  constructor(
    protected readonly initialView: string,
    readonly interaction: RepliableInteraction,
    props: MenuProps & Partial<IntrinsicMenuProps>
  ) {
    this.activeView = initialView;
    this.props = Object.assign({ ...DefaultProperties }, props);
    this.message = this.props.initialMessage;
    this.registeredViews = new Map();
    this.cachedViews = new Map();
    this.router = new Router(this);
  }

  /** Swap the current displayed view. */
  swapView(viewId: string, args: unknown[]) {
    this.activeView = viewId;
    this.getView(viewId).onSwap(...args);
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

  /**
   * Force a reply to the initial interaction instead of dynamically rendering.
   */
  async reply() {
    return this.render(true);
  }

  /** Render the currently-active view to the original interaction. */
  async render(forceReply = false) {
    const view = this.getCurrentView();
    const collectorEnded = this.collector?.ended;
    const endReason = this.collector?.endReason;
    let renderTarget = this.interaction;

    /**
     * If rendering after each collected interaction, swap render target to
     * latest collected
     */
    if (
      this.props.renderAfterHandledInteraction &&
      this.latestInteractionCollected
    ) {
      renderTarget = this.latestInteractionCollected;
    }

    if (!collectorEnded) {
      await view.triggerPreloads();
    }

    const viewPayload = view.messagePayload();
    if (collectorEnded) {
      appendTimeoutEmbed(viewPayload, endReason);
      viewPayload.components = [];
    }

    this.message = await safeRender(renderTarget, viewPayload, forceReply);

    if (!this.collector) {
      this.initCollector();
    }
  }

  /** End the listener with a given reason, ending interactivity as a result. */
  protected endListener(reason?: string) {
    return this.collector?.stop(reason);
  }

  /** Register a MenuView class to the menu. */
  registerView<ViewProps extends NonNullable<unknown>>(
    id: string,
    view: new (props: ViewProps) => MenuView<
      typeof this.props extends ViewProps ? ViewProps : never
    >
  ) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.registeredViews.set(id, view);
    console.log(`Registering view with id: ${id}`);
  }

  private getView(id: string): MenuView {
    if (this.registeredViews.size < 1) {
      throw new InteractiveMenuError(
        `There are no registered views in this InteractiveMenu. Use ` +
          `'registerView()' on each of your MenuViews.`
      );
    }
    // get view definition
    const currentViewClass = this.registeredViews.get(id);
    if (!currentViewClass) {
      throw new InteractiveMenuError(
        `'${id}' is not a registered view in InteractiveMenu ` +
          `${this.id}. Ensure you use 'registerView()' on each of your ` +
          `MenuViews.\n\n` +
          `Registered views: [${[...this.registeredViews.keys()].join(', ')}]`
      );
    }
    // initialize view if not already
    let viewInstance = this.cachedViews.get(id);
    if (!viewInstance) {
      viewInstance = new currentViewClass(this.props);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore-next-line: Attach router instance.
      viewInstance.__router = this.router;
      this.cachedViews.set(id, viewInstance);
    }
    return viewInstance;
  }

  private getCurrentView() {
    return this.getView(this.activeView);
  }

  private initCollector() {
    if (!this.message) {
      throw new InteractiveMenuError(
        `Unable to initialize collectors; 'message' is undefined.`
      );
    }

    this.collector = this.message.createMessageComponentCollector({
      filter: (i) =>
        i.user.id === this.interaction.user.id &&
        i.channelId === this.interaction.channelId,
      idle: this.idleTimeMs ?? DEFAULT_IDLE,
    });

    this.collector.on('collect', async (collected) => {
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
        this.props.renderAfterHandledInteraction = false;
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

    await this.getCurrentView().__passCollectedInteractionToHandler(collected);

    if (this.props.renderAfterHandledInteraction) {
      await this.render();
    }
  }
}

class InteractiveMenuError extends Error {
  constructor(message: string) {
    super(message);
  }
}
