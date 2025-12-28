import { assert } from '../util/Assertions.js';
import type { View } from './views/view.js';
import type { RenderedReactiveView } from './views/viewFlavors.js';
import {
  CollectorService,
  type ComponentCallbackMap,
} from './menu/instance/collectorService.js';

export interface NavigationPayload {
  view: View;
  collectorMap: ComponentCallbackMap;
  reactiveInstance: RenderedReactiveView | undefined;
}

export class Navigation {
  views: NavigationPayload[] = [];

  constructor(private readonly collectorService: CollectorService) {}

  push(view: View): void {
    this.views.push({
      view,
      collectorMap: this.collectorService.snapshot(),
      reactiveInstance: undefined,
    });
  }

  pushReactive(view: View, reactiveInstance: RenderedReactiveView) {
    this.views.push({
      view,
      reactiveInstance,
      collectorMap: this.collectorService.snapshot(),
    });
  }

  empty(): boolean {
    return !this.views.length;
  }

  peek(): NavigationPayload {
    const data = this.views.at(-1);
    assert(data);
    return data;
  }

  pop(): NavigationPayload {
    const data = this.views.pop();
    assert(data);
    this.collectorService.resume(data.collectorMap);
    return data;
  }
}
