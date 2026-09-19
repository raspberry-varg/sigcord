import {AsyncLocalStorage} from 'node:async_hooks';

import {
  ImperativeLockContext,
  ImperativeLockKind,
} from '../../core/contexts/imperativeLock.js';
import {coreLog} from '../../internal/coreLog.js';
import type {ContextNode} from '../contexts/contextNode.js';
import {provideContextValue} from '../contexts/provideContext.js';
import type {DisposeFn, ResumeFn, SuspendFn} from '../render/dispose.js';

export interface Owner extends Disposable {
  readonly context: ContextNode;
  readonly parent: Owner | null;
  readonly childOwners: Set<Owner>;
  debugName?: string;
  readonly disposed: boolean;
  readonly suspended: boolean;

  registerDisposal(disposal: DisposeFn): void;

  registerComponentDisposal(id: string, disposal: DisposeFn): void;

  registerOnSuspend(onSuspend: SuspendFn): void;

  registerOnResume(onResume: ResumeFn): void;

  addChild(owner: Owner): void;

  removeChild(owner: Owner): void;

  suspend(): void;

  resume(): void;

  dispose(): void;

  [Symbol.dispose](): void;
}

class OwnerImpl implements Owner {
  childOwners: Set<Owner> = new Set<Owner>();
  debugName?: string;

  readonly context: ContextNode;

  private disposals: DisposeFn[] = [];
  private componentDisposals = new Map<string, DisposeFn>();
  private onSuspendFns: SuspendFn[] = [];
  private onResumeFns: ResumeFn[] = [];
  private _disposed = false;
  private _suspended = false;

  constructor(public parent: Owner | null) {
    this.context = this.parent ? Object.create(this.parent.context) : {};
  }

  get disposed() {
    return this._disposed;
  }

  get suspended() {
    return this._suspended;
  }

  registerDisposal(disposal: DisposeFn): void {
    this.disposals.push(disposal);
  }

  registerComponentDisposal(id: string, disposal: DisposeFn): void {
    const existing = this.componentDisposals.get(id);
    existing?.();
    this.componentDisposals.set(id, disposal);
  }

  registerOnSuspend(onSuspend: SuspendFn): void {
    this.onSuspendFns.push(onSuspend);
  }

  registerOnResume(onResume: ResumeFn): void {
    this.onResumeFns.push(onResume);
  }

  addChild(child: Owner): void {
    this.childOwners.add(child);
  }

  removeChild(child: Owner): void {
    this.childOwners.delete(child);
  }

  suspend() {
    if (this.disposed || this.suspended) return;
    this._suspended = true;

    this.runCallbacksWithLock(ImperativeLockKind.Suspend, this.onSuspendFns);

    for (const child of this.childOwners) {
      child.suspend();
    }
  }

  resume() {
    if (this.disposed || !this.suspended) return;
    this._suspended = false;

    this.runCallbacksWithLock(ImperativeLockKind.Resume, this.onResumeFns);
    for (const child of this.childOwners) {
      child.resume();
    }
  }

  private runCallbacksWithLock(
    lock: ImperativeLockKind,
    callbacks: ReadonlyArray<() => void>,
  ) {
    if (!callbacks.length) {
      return;
    }
    runWithOwner(this, () => {
      for (let i = 0; i < callbacks.length; i++) {
        owner(() => {
          provideContextValue(ImperativeLockContext, lock);
          callbacks[i]();
          return getOwnerOrThrow();
        }).dispose();
      }
    });
  }

  dispose() {
    if (this.disposed) return;
    this._disposed = true;

    this.childOwners.forEach(disposeOwner);
    this.childOwners.clear();

    coreLog.verbose('DisposingOwner.', {
      debugName: this.debugName ?? '',
      toDispose: {
        disposalFns: this.disposals,
        childOwners: this.childOwners,
      },
    });

    // Since we're cleaning up, let's just lock it in its entirety.
    this.context[ImperativeLockContext.id] = ImperativeLockKind.Cleanup;
    while (this.disposals.length) {
      const batch = this.disposals;
      this.disposals = [];
      for (let i = 0; i < batch.length; i++) {
        runWithOwner(this, batch[i]);
      }
    }
    this.disposals.length = 0;
    this.componentDisposals.forEach((dispose) => runWithOwner(this, dispose));
    this.componentDisposals.clear();

    if (this.parent) {
      this.parent.removeChild(this);
      this.parent = null;
    }
  }

  [Symbol.dispose]() {
    this.dispose();
  }
}

const ownerStore = new AsyncLocalStorage<Owner | null>();

export function getOwner(): Owner | null {
  return ownerStore.getStore() ?? null;
}

export function getOwnerOrThrow(): Owner {
  const openOwner = getOwner();
  if (!openOwner) {
    throw new Error('No current owner. Were we called outside a menu context?');
  }
  return openOwner;
}

export function useDisposeOwnerFn(): DisposeFn | undefined {
  const openOwner = getOwner();
  return openOwner?.dispose.bind(openOwner);
}

export function disposeOwner(toDispose: Owner | null) {
  toDispose?.dispose();
}

export function setCurrentOwner(newOwner: Owner | null): Owner | null {
  const prev = ownerStore.getStore() ?? null;
  ownerStore.enterWith(newOwner);
  return prev;
}

interface OwnerOptions {
  debugName?: string;
  /**
   * @default true
   */
  autoReparent?: boolean;
}

/**
 * Run a function under a new owner.
 * @param ownerFn
 */
export function owner<T>(ownerFn: () => T, options?: OwnerOptions): T {
  coreLog.verbose(
    `creating a new owner(${options?.debugName}) with fn=${ownerFn}`,
  );
  const newOwner = new OwnerImpl(
    options?.autoReparent === false ? null : getOwner(),
  );
  if (options?.debugName) {
    newOwner.debugName = options.debugName;
  }

  if (options?.autoReparent) {
    const currentOwner = getOwner();
    if (currentOwner) {
      currentOwner.addChild(newOwner);
    }
  }

  return runWithOwner(newOwner, ownerFn);
}

export function createRootOwner(): Owner {
  return new OwnerImpl(null);
}

export function runWithOwner<T>(withOwner: Owner | null, ownerFn: () => T): T {
  return ownerStore.run(withOwner, ownerFn);
}
