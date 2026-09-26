import { AsyncLocalStorage } from 'node:async_hooks';

import { ImperativeLockContext, ImperativeLockKind } from '../../core/contexts/imperativeLock.js';
import { coreLog } from '../../internal/coreLog.js';
import {
  dropContextValue,
  provideContextValue,
  setContextValueTo,
} from '../contexts/provideContext.js';

import type { ContextNode } from '../contexts/contextNode.js';
import type { DisposeFn, ResumeFn, SuspendFn } from '../render/dispose.js';

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
    if (this.disposed) {
      coreLog.warn('Attempted to add a child to a disposed owner', { debugName: this.debugName });
      child.dispose();
      return;
    }
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

  private runCallbacksWithLock(lock: ImperativeLockKind, callbacks: ReadonlyArray<() => void>) {
    if (!callbacks.length) {
      return;
    }
    try {
      setContextValueTo(this, ImperativeLockContext, lock);
      runWithOwner(this, () => {
        for (let i = 0; i < callbacks.length; i++) {
          provideContextValue(ImperativeLockContext, lock);
          callbacks[i]();
        }
      });
    } finally {
      dropContextValue(ImperativeLockContext);
    }
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

/**
 * Transparent owner that creates an isolated context boundary for async handlers, forwarding all
 * lifecycle events.
 */
export class ContextShadowOwner implements Owner {
  readonly context: ContextNode;

  constructor(private readonly target: Owner) {
    // Inherit the context prototype chain so `useContext` still finds parent data
    this.context = Object.create(target.context);
  }

  get parent() {
    return this.target.parent;
  }
  get childOwners() {
    return this.target.childOwners;
  }
  get debugName() {
    return `Shadow(${this.target.debugName})`;
  }
  get disposed() {
    return this.target.disposed;
  }
  get suspended() {
    return this.target.suspended;
  }

  registerDisposal(disposal: DisposeFn) {
    this.target.registerDisposal(disposal);
  }
  registerComponentDisposal(id: string, disposal: DisposeFn) {
    this.target.registerComponentDisposal(id, disposal);
  }
  registerOnSuspend(onSuspend: SuspendFn) {
    this.target.registerOnSuspend(onSuspend);
  }
  registerOnResume(onResume: ResumeFn) {
    this.target.registerOnResume(onResume);
  }
  addChild(child: Owner) {
    this.target.addChild(child);
  }
  removeChild(child: Owner) {
    this.target.removeChild(child);
  }
  suspend() {
    this.target.suspend();
  }
  resume() {
    this.target.resume();
  }

  dispose() {
    // Explicitly do absolutely nothing, just passin' thru.
  }
  [Symbol.dispose]() {}
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
}

/**
 * Run a function under a new owner.
 * @param ownerFn
 */
export function owner<T>(
  ownerFn: () => T,
  options?: OwnerOptions & {
    /**
     * @default true
     */
    autoReparent?: boolean;
  },
): T {
  const newOwner = createOwner(options?.autoReparent === false ? null : getOwner(), options);
  return runWithOwner(newOwner, ownerFn);
}

export function createRootOwner(): Owner {
  return new OwnerImpl(null);
}

export function createOwner(parent: Owner | null, options?: OwnerOptions): Owner {
  coreLog.verbose(`creating a new owner(${options?.debugName})`);
  const newOwner = new OwnerImpl(parent);
  if (options?.debugName) {
    newOwner.debugName = options.debugName;
  }
  parent?.addChild(newOwner);
  return newOwner;
}

export function runWithOwner<T>(withOwner: Owner | null, ownerFn: () => T): T {
  return ownerStore.run(withOwner, ownerFn);
}
