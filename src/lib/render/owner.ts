import { logger } from '../../util/Logger.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import { ViewNode } from '../dom/viewNode.js';
import type { ViewNodeKind } from '../dom/viewNodeKind.js';
import type { Children } from '../MenuView.js';
import type { Recursive } from '../recursive.js';
import { PatchTarget } from '../RenderingEngine.js';
import type { DisposeFn } from './dispose.js';
import { flattenToContentNodes } from './flattenToContentNodes.js';

export class Owner<T extends ViewNodeKind = ViewNodeKind>
  implements Disposable
{
  readonly root = new ViewElementNode<T>();
  patchTarget?: PatchTarget;
  parent: Owner<T> | null = null;
  childOwners = new Set<Owner<T>>();
  debugName?: string;

  private disposals: DisposeFn[] = [];
  private componentDisposals = new Map<string, DisposeFn>();
  private readonly nodes: ViewNode<T>[] = [];
  private disposed_ = false;

  constructor() {}

  get disposed() {
    return this.disposed_;
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

  addChild(owner: Owner<T>): void {
    this.childOwners.add(owner);
  }

  removeChild(owner: Owner<T>): void {
    this.childOwners.delete(owner);
  }

  dispose() {
    if (this.disposed) return;

    // TODO: @raspberry-varg - Implement disposal.
    logger.debug('Disposing Owner.', {
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
    this.childOwners.forEach((owner) => owner.dispose());
    this.childOwners.clear();

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
  logger.debug('getting current open owner', { currentOwner });
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

export function owner<T extends ViewNodeKind>(
  ownerFn: () => Children<T> | void,
  patchTarget?: PatchTarget,
): Owner<T> {
  logger.debug(`creating a new owner with fn=${ownerFn}`);
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
