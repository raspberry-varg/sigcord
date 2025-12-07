import { logger } from '../../util/Logger.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import { ViewNode } from '../dom/viewNode.js';
import type { BaseViewNodeKind, ViewNodeKind } from '../dom/viewNodeKind.js';
import type { Recursive } from '../recursive.js';
import { PatchTarget } from '../RenderingEngine.js';
import type { DisposeFn, ResumeFn, SuspendFn } from './dispose.js';
import { flattenToContentNodes } from './flattenToContentNodes.js';
import { flatten } from './flatten.js';

export class Owner<T extends BaseViewNodeKind = BaseViewNodeKind>
  implements Disposable
{
  readonly root = new ViewElementNode<T>();
  patchTarget?: PatchTarget;
  parent: Owner | null = null;
  childOwners: Set<Owner> = new Set<Owner>();
  debugName?: string;

  private disposals: DisposeFn[] = [];
  private componentDisposals = new Map<string, DisposeFn>();
  private onSuspendFns: SuspendFn[] = [];
  private onResumeFns: ResumeFn[] = [];
  private readonly nodes: ViewNode<T>[] = [];
  private disposed_ = false;
  private suspended_ = false;

  constructor() {}

  get disposed() {
    return this.disposed_;
  }

  get suspended() {
    return this.suspended_;
  }

  getNodes(): readonly ViewNode<T>[] {
    return this.nodes;
  }

  registerNode(node: ViewNode<T>): void {
    this.nodes.push(node);
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
    if (this.disposed || this.suspended === true) return;
    this.suspended_ = true;

    for (let i = 0; i < this.onSuspendFns.length; i++) {
      this.onSuspendFns[i]();
    }

    for (const child of this.childOwners) {
      child.suspend();
    }
  }

  resume() {
    if (this.disposed || this.suspended === false) return;
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

    this.childOwners.forEach((owner) => owner.dispose());
    this.childOwners.clear();

    logger.verbose('DisposingOwner.', {
      debugName: this.debugName ?? '',
      toDispose: {
        disposalFns: this.disposals,
        nodes: this.nodes,
        childOwners: this.childOwners,
      },
    });

    this.disposals.forEach((dispose) => dispose());
    this.disposals.length = 0;
    this.componentDisposals.forEach((dispose) => dispose());
    this.componentDisposals.clear();
    this.root.dispose();
    this.nodes.forEach((node) => node.dispose());
    this.nodes.length = 0;

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

export function owner<T extends BaseViewNodeKind>(
  ownerFn: () => ViewNodeKind<T> | void,
  patchTarget?: PatchTarget,
): Owner<T> {
  logger.verbose(`creating a new owner with fn=${ownerFn}`);
  const newOwner = new Owner<T>();
  const prevOwner = setCurrentOwner(newOwner);
  newOwner.patchTarget = prevOwner?.patchTarget ?? patchTarget;
  newOwner.parent = prevOwner;
  prevOwner?.addChild(newOwner);

  let content;
  try {
    content = ownerFn();
    if (content) {
      const root = newOwner.root;
      const nodes = flattenToContentNodes(
        content as Recursive<T | ViewNode<T>>,
      );
      root.addChild(...nodes);
    }
  } finally {
    setCurrentOwner(prevOwner);
  }
  return newOwner;
}
