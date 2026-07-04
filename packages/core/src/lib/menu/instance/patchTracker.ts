import {
  PatchTarget,
  type PatchTargetBitMask,
  type RenderingEngine,
} from '../../RenderingEngine.js';
import { Logger } from '../../../util/Logger.js';
import type { CollectorService } from './collectorService.js';

export class PatchTracker {
  private logger = Logger.namespaced('PatchTracker');
  private manualPatchQueued: PatchTargetBitMask = 0;

  constructor(
    private readonly renderer: RenderingEngine,
    private readonly collector: CollectorService,
  ) {}

  add(toOr: PatchTargetBitMask): void {
    this.manualPatchQueued |= toOr;
  }

  reset(): void {
    this.manualPatchQueued = 0;
  }

  collectTargets(): PatchTargetBitMask {
    this.logger.debug({
      collectorEnded: this.collector.hasEnded(),
      collectorInitialized: this.collector.isInitialized(),
      isCurrentViewReactive: this.renderer.isCurrentViewReactive(),
      rendererHasQueuedView: this.renderer.hasQueuedView(),
      manualPatchQueued: this.manualPatchQueued,
    });

    const manual = this.manualPatchQueued;
    this.manualPatchQueued = 0;

    if (this.collector.hasEnded()) {
      return PatchTarget.None;
    }
    // do not wait for a dirty signal graph to render a queued view
    if (this.renderer.hasQueuedView()) {
      return PatchTarget.All;
    }
    if (this.renderer.isCurrentViewReactive()) {
      let patchTargets: PatchTargetBitMask = manual;
      if (this.renderer.hasQueuedEmbeds()) {
        patchTargets |= PatchTarget.Embeds;
      }
      if (this.renderer.hasQueuedNavigation()) {
        patchTargets |= PatchTarget.All;
      }
      this.logger.debug({ patchTargetBitMask: patchTargets });
      return patchTargets;
    }
    return PatchTarget.All;
  }
}
