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

  push(view: View, reactiveInstance?: RenderedReactiveView): void {
    this.views.push({
      view,
      reactiveInstance,
      collectorMap: this.collectorService.snapshot(),
    });
  }

  empty(): boolean {
    return !this.views.length;
  }

  pop(): NavigationPayload {
    const data = this.views.pop();
    assert(data);
    this.collectorService.resume(data.collectorMap);
    return data;
  }
}
