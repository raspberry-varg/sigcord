type PromiseResolver<T> = (value: T | PromiseLike<T>) => void;
type ListenerCallback<T> = (value: T) => unknown;

export class SingleEvent<ResolveType = unknown> {
  private once?: ListenerCallback<ResolveType>[];
  private subscribed?: ListenerCallback<ResolveType>[];
  private waiting?: PromiseResolver<ResolveType>[];

  doOnce(callback: ListenerCallback<ResolveType>) {
    (this.once ??= []).push(callback);
  }

  do(callback: ListenerCallback<ResolveType>, once = false) {
    if (once) {
      this.doOnce(callback);
      return;
    }
    (this.subscribed ??= []).push(callback);
  }

  asPromise(): Promise<ResolveType> {
    return new Promise((resolve) => {
      (this.waiting ??= []).push(resolve);
    });
  }

  fire(resolveResult: ResolveType) {
    const callWithResult = (cb: PromiseResolver<ResolveType> | ListenerCallback<ResolveType>) =>
      cb(resolveResult);
    if (this.once) {
      this.once.forEach(callWithResult);
      this.once.length = 0;
    }
    this.subscribed?.forEach(callWithResult);
    if (this.waiting) {
      this.waiting.forEach(callWithResult);
      this.waiting.length = 0;
    }
  }
}
