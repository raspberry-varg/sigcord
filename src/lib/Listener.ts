type PromiseResolver<T> = (value: T | PromiseLike<T>) => void;
type ListenerCallback<T> = (value: T) => unknown;

export class Listener<ResolveType = unknown> {
  private oncely: ListenerCallback<ResolveType>[] = [];
  private subscribed: ListenerCallback<ResolveType>[] = [];
  private waiting: PromiseResolver<ResolveType>[] = [];

  doOnce(callback: ListenerCallback<ResolveType>) {
    this.oncely.push(callback);
  }

  do(callback: ListenerCallback<ResolveType>, once = false) {
    if (once) {
      this.doOnce(callback);
      return;
    }
    this.subscribed.push(callback);
  }

  asPromise(): Promise<ResolveType> {
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  fire(resolveResult: ResolveType) {
    const callWithResult = (
      cb: PromiseResolver<ResolveType> | ListenerCallback<ResolveType>
    ) => cb(resolveResult);
    this.oncely.forEach(callWithResult);
    this.oncely.length = 0;
    this.subscribed.forEach(callWithResult);
    this.waiting.forEach(callWithResult);
  }
}
