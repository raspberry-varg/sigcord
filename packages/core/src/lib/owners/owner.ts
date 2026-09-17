import { logger } from '../../util/Logger.js';
import { PatchTarget } from '../RenderingEngine.js';
import type { DisposeFn, ResumeFn, SuspendFn } from '../render/dispose.js';
import type { ContextNode } from '../contexts/contextNode.js';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface Owner extends Disposable {
  readonly patchTarget?: PatchTarget;
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
  patchTarget?: PatchTarget;
  childOwners: Set<Owner> = new Set<Owner>();
  debugName?: string;

  readonly context: ContextNode;

  private disposals: DisposeFn[] = [];
  private componentDisposals = new Map<string, DisposeFn>();
  private onSuspendFns: SuspendFn[] = [];
  private onResumeFns: ResumeFn[] = [];
  private disposed_ = false;
  private suspended_ = false;

  constructor(public parent: Owner | null) {
    this.context = this.parent ? Object.create(this.parent.context) : {};
  }

  get disposed() {
    return this.disposed_;
  }

  get suspended() {
    return this.suspended_;
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

  addChild(owner: Owner): void {
    this.childOwners.add(owner);
  }

  removeChild(owner: Owner): void {
    this.childOwners.delete(owner);
  }

  suspend() {
    if (this.disposed || this.suspended) return;
    this.suspended_ = true;

    for (let i = 0; i < this.onSuspendFns.length; i++) {
      this.onSuspendFns[i]();
    }

    for (const child of this.childOwners) {
      child.suspend();
    }
  }

  resume() {
    if (this.disposed || !this.suspended) return;
    this.suspended_ = false;

    for (let i = 0; i < this.onResumeFns.length; i++) {
      this.onResumeFns[i]();
    }

    for (const child of this.childOwners) {
      child.resume();
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed_ = true;

    this.childOwners.forEach((owner) => owner.dispose());
    this.childOwners.clear();

    logger.verbose('DisposingOwner.', {
      debugName: this.debugName ?? '',
      toDispose: {
        disposalFns: this.disposals,
        childOwners: this.childOwners,
      },
    });

    this.disposals.forEach((dispose) => dispose());
    this.disposals.length = 0;
    this.componentDisposals.forEach((dispose) => dispose());
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
  const owner = getOwner();
  if (!owner) {
    throw new Error('No current owner. Were we called outside a menu context?');
  }
  return owner;
}

export function setCurrentOwner(newOwner: Owner | null): Owner | null {
  const prev = ownerStore.getStore() ?? null;
  ownerStore.enterWith(newOwner);
  return prev;
}

export function owner<T>(ownerFn: () => T, patchTarget?: PatchTarget): Owner {
  logger.verbose(`creating a new owner with fn=${ownerFn}`);
  const newOwner = new OwnerImpl(getOwner());
  const prevOwner = setCurrentOwner(newOwner);
  newOwner.patchTarget = prevOwner?.patchTarget ?? patchTarget;
  prevOwner?.addChild(newOwner);

  runWithOwner(newOwner, ownerFn);
  return newOwner;
}

export function createRootOwner(): Owner {
  return new OwnerImpl(null);
}

export function runWithOwner<T>(owner: Owner | null, ownerFn: () => T): T {
  return ownerStore.run(owner, ownerFn);
}
