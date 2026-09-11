import { logger } from '../../util/Logger.js';
import { PatchTarget } from '../RenderingEngine.js';
import type { DisposeFn, ResumeFn, SuspendFn } from '../render/dispose.js';
import type { ContextNode } from '../contexts/contextNode.js';

export interface Owner extends Disposable {
  readonly patchTarget?: PatchTarget;
  readonly context?: ContextNode;
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
  context?: ContextNode;
  parent: Owner | null = null;
  childOwners: Set<Owner> = new Set<Owner>();
  debugName?: string;

  private disposals: DisposeFn[] = [];
  private componentDisposals = new Map<string, DisposeFn>();
  private onSuspendFns: SuspendFn[] = [];
  private onResumeFns: ResumeFn[] = [];
  private disposed_ = false;
  private suspended_ = false;

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
    this.context = undefined;

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

let currentOwner: Owner | null = null;

export function getOpenOwner(): Owner | null {
  logger.verbose('getting current open owner', { currentOwner });
  return currentOwner;
}

export function getOpenOwnerStrict(): Owner {
  const owner = getOpenOwner();
  if (!owner) {
    throw new Error('No current owner. Was there an asynchronous break?');
  }
  return owner;
}

export function setCurrentOwner(newOwner: Owner | null): Owner | null {
  const prev = currentOwner;
  currentOwner = newOwner;
  return prev;
}

export function owner<T>(
  ownerFn: () => T,
  patchTarget?: PatchTarget,
  contextNode?: ContextNode,
): Owner {
  logger.verbose(`creating a new owner with fn=${ownerFn}`);
  const newOwner = new OwnerImpl();
  const prevOwner = setCurrentOwner(newOwner);
  newOwner.patchTarget = prevOwner?.patchTarget ?? patchTarget;
  newOwner.parent = prevOwner;
  newOwner.context = contextNode ?? prevOwner?.context; // Reduce extra lookup loops.
  prevOwner?.addChild(newOwner);

  try {
    ownerFn();
  } finally {
    setCurrentOwner(prevOwner);
  }
  return newOwner;
}
