import { assert } from '../util/Assertions.js';
import type { View } from './FunctionalMenuView.js';
import type { RenderedReactiveViewPayload } from './MenuView.js';
import type { EffectInstance } from './Reactivity.js';

export interface NavigationPayload {
  view: View;
  effects: EffectInstance[];
  reactive: RenderedReactiveViewPayload | undefined;
}

export class Navigation {
  views: View[] = [];
  effects: EffectInstance[][] = [];
  reactive: Array<RenderedReactiveViewPayload | undefined> = [];

  push(view: View) {
    this.views.push(view);
    this.effects.push([]);
    this.reactive.push(undefined);
  }

  pushReactive(
    view: View,
    reactivePayload: RenderedReactiveViewPayload,
    effects: EffectInstance[]
  ) {
    this.views.push(view);
    this.effects.push(effects);
    this.reactive.push(reactivePayload);
  }

  empty(): boolean {
    return !this.views.length;
  }

  peek(): NavigationPayload {
    const view = this.views.at(-1);
    const effects = this.effects.at(-1);
    assert(view);
    assert(effects);
    return {
      view,
      effects,
      reactive: this.reactive.pop(),
    };
  }

  pop(): NavigationPayload {
    const view = this.views.pop();
    const effects = this.effects.pop();
    assert(view);
    assert(effects);
    return {
      view,
      effects,
      reactive: this.reactive.pop(),
    };
  }
}
