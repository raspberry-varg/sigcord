import { logger } from '../../util/Logger.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import { ViewNode } from '../dom/viewNode.js';
import type { ViewNodeKind, ViewNodeKindBase } from '../dom/viewNodeKind.js';
import type { Recursive } from '../recursive.js';
import { PatchTarget } from '../RenderingEngine.js';
import type { DisposeFn, ResumeFn, SuspendFn } from '../render/dispose.js';
import { flattenToContentNodes } from '../render/flattenToContentNodes.js';
import { flatten } from '../render/flatten.js';
import type { ContextNode } from '../contexts/contextNode.js';

export interface Owner<
  T extends ViewNodeKindBase = ViewNodeKindBase,
> extends Disposable {
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

  addChild(owner: Owner<T>): void;

  removeChild(owner: Owner<T>): void;

  suspend(): void;

  resume(): void;

  /**
   * @deprecated Use a {@link ViewElementNode} that was rendered within an owner.
   */
  flatten(): T[];

  dispose(): void;

  [Symbol.dispose](): void;
}

class OwnerImpl<
  T extends ViewNodeKindBase = ViewNodeKindBase,
> implements Owner<T> {
  /** @deprecated Remove me */
  root = new ViewElementNode<T>();
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

  addChild(owner: Owner<T>): void {
    this.childOwners.add(owner);
  }

  removeChild(owner: Owner<T>): void {
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

  flatten() {
    return flatten<T>(this.root, this);
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
    this.root.dispose();

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

export function owner<T extends ViewNodeKindBase>(
  ownerFn: () => ViewNodeKind<T> | void,
  patchTarget?: PatchTarget,
  contextNode?: ContextNode,
): Owner<T> {
  logger.verbose(`creating a new owner with fn=${ownerFn}`);

  const root = new ViewElementNode<T>();
  const newOwner = ownerLite<void>(
    () => {
      const content = ownerFn();
      if (content) {
        const nodes = flattenToContentNodes(
          content as Recursive<T | ViewNode<T>>,
        );
        root.addChild(...nodes);
      }
    },
    patchTarget,
    contextNode,
  );
  (newOwner as OwnerImpl).root = root;
  return newOwner as Owner<T>;
}

// TODO: Owner should be decoupled from the "DOM" tree.
export function ownerLite<T>(
  ownerFn: () => T,
  patchTarget?: PatchTarget,
  contextNode?: ContextNode,
): Owner {
  logger.verbose(`creating a new LITE owner with fn=${ownerFn}`);
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
