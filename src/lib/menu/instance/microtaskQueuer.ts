export function microtaskQueuer(
  cb: () => void | Promise<void>,
): MicrotaskQueuer {
  return new MicrotaskQueuer(cb);
}

export class MicrotaskQueuer {
  private queued = false;

  constructor(private readonly cb: () => void | Promise<void>) {}

  set(): void {
    if (this.queued) {
      return;
    }
    this.queued = true;

    queueMicrotask(async (): Promise<void> => {
      this.queued = false;
      await this.cb();
    });
  }
}
