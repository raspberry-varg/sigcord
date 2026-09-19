export function microtaskQueuer(cb: () => void | Promise<void>): MicrotaskQueuer {
  return new MicrotaskQueuer(cb);
}

export function simpleMicrotaskQueuer(cb: () => void | Promise<void>): () => void {
  let queued = false;
  return () => {
    if (queued) {
      return;
    }
    queued = true;

    queueMicrotask(async (): Promise<void> => {
      queued = false;
      await cb();
    });
  };
}

export class MicrotaskQueuer<T extends unknown[] = never[]> {
  private queued = false;

  constructor(
    private readonly cb: (...args: T) => void | Promise<void>,
    private readonly args?: T,
  ) {}

  private task = async (): Promise<void> => {
    this.queued = false;
    if (this.args) {
      await this.cb(...this.args);
    } else {
      await (this.cb as () => void | Promise<void>)();
    }
  };

  set(): void {
    if (this.queued) return;

    this.queued = true;
    queueMicrotask(this.task);
  }
}
