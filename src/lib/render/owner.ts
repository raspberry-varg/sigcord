import { logger } from '../../util/Logger.js';
import { ViewElementNode } from '../dom/viewElementNode.js';
import { ViewNode } from '../dom/viewNode.js';
import type { ViewNodeKind } from '../dom/viewNodeKind.js';
import type { Children } from '../MenuView.js';
import type { Recursive } from '../recursive.js';
import type { DisposeFn } from './dispose.js';
import { flattenToContentNodes } from './flattenToContentNodes.js';

export class Owner<T extends ViewNodeKind = ViewNodeKind>
  implements Disposable
{
  private effectDisposals: DisposeFn[] = [];
  private readonly nodes: ViewNode<T>[] = [];

  public readonly root = new ViewElementNode<T>();
  public parent: Owner<T> | null = null;
  public childOwners = new Set<Owner<T>>();

  getNodes(): readonly ViewNode<T>[] {
    return this.nodes;
  }

  registerNode(node: ViewNode<T>): void {
    this.nodes.push(node);
  }

  registerDisposal(disposal: DisposeFn): void {
    this.effectDisposals.push(disposal);
  }

  addChild(owner: Owner<T>): void {
    this.childOwners.add(owner);
  }

  removeChild(owner: Owner<T>): void {
    this.childOwners.delete(owner);
  }

  dispose() {
    // TODO: @raspberry-varg - Implement disposal.
    logger.debug('Disposing Owner.', {
      toDispose: {
        effects: this.effectDisposals,
        nodes: this.nodes,
        childOwners: this.childOwners,
      },
    });
    this.effectDisposals.forEach((dispose) => dispose());
    this.effectDisposals.length = 0;
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
  ownerFn: () => Children<T | ViewNode<T>>,
): Owner<T> {
  logger.debug(`creating a new owner with fn=${ownerFn}`);
  const newOwner = new Owner<T>();
  const prevOwner = setCurrentOwner(newOwner);
  let content;
  try {
    content = ownerFn();
    const root = newOwner.root;
    const nodes = flattenToContentNodes(content as Recursive<T | ViewNode<T>>);
    root.addChild(...nodes);
  } finally {
    setCurrentOwner(prevOwner);
  }
  return newOwner;
}
