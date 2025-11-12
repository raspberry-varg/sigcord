import { assert } from '../util/Assertions.js';
import type { View } from './views/view.js';
import type { RenderedReactiveView } from './views/viewFlavors.js';

export interface NavigationPayload {
  view: View;
  reactiveInstance: RenderedReactiveView | undefined;
}

export class Navigation {
  views: View[] = [];
  reactive: Array<RenderedReactiveView | undefined> = [];

  push(view: View) {
    this.views.push(view);
    this.reactive.push(undefined);
  }

  pushReactive(view: View, reactivePayload: RenderedReactiveView) {
    this.views.push(view);
    this.reactive.push(reactivePayload);
  }

  empty(): boolean {
    return !this.views.length;
  }

  peek(): NavigationPayload {
    const view = this.views.at(-1);
    assert(view);
    return {
      view,
      reactiveInstance: this.reactive.pop(),
    };
  }

  pop(): NavigationPayload {
    const view = this.views.pop();
    assert(view);
    return {
      view,
      reactiveInstance: this.reactive.pop(),
    };
  }
}
