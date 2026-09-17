import type { InteractionMiddleware } from './interactionMiddleware.js';
import type { ViewNodeKind } from '../lib/dom/viewNodeKind.js';
import type { RepliableInteraction } from 'discord.js';
import { Cord } from './cord.js';
import { ComponentsV2Strand } from './strands/componentsV2Strand.js';

export type ViewFactory = () => ViewNodeKind;

export type Wrapper = (children: ViewFactory) => ViewNodeKind;

/**
 * Fluent builder for interactive menus. This is the entry point for all menus
 * managed by Sigcord.
 */
export class MenuBuilder {
  private isEphemeral = false;
  private readonly middlewares: InteractionMiddleware[] = [];
  private readonly wrappers: Wrapper[] = [];

  constructor(base?: MenuBuilder) {
    if (base) {
      this.isEphemeral = base.isEphemeral;
      this.middlewares = base.middlewares.slice();
      this.wrappers = base.wrappers.slice();
    }
  }

  ephemeral(value = true) {
    this.isEphemeral = value;
    return this;
  }

  use(middleware: InteractionMiddleware) {
    this.middlewares.push(middleware);
    return this;
  }

  wrap(wrapper: Wrapper) {
    this.wrappers.push(wrapper);
    return this;
  }

  async mount(interaction: RepliableInteraction, rootView: ViewFactory) {
    const cord = new Cord(
      (cord, factory) => new ComponentsV2Strand(cord, factory),
    );
    for (let i = 0; i < this.middlewares.length; i++) {
      cord.use(this.middlewares[i]);
    }
    const wrapped = this.applyWrappers(rootView);
    cord.pushStrand(cord.createStrand(wrapped));
    return cord.mount(interaction, this.isEphemeral);
  }

  private applyWrappers(rootView: ViewFactory): ViewFactory {
    for (let i = this.wrappers.length - 1; i >= 0; i--) {
      const wrapper = this.wrappers[i];
      const inner = rootView;
      rootView = () => wrapper(inner);
    }
    return rootView;
  }
}
