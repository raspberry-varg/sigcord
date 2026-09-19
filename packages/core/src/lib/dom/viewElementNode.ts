import {coreLog} from '../../internal/coreLog.js';
import {removeManyInPlace} from '../../util/arrays/removeManyInPlace.js';
import {ViewNode} from './viewNode.js';
import type {ViewNodeKind} from './viewNodeKind.js';

export class ViewElementNode<
  T extends ViewNodeKind = ViewNodeKind,
> extends ViewNode<T> {
  private readonly _children: ViewNode<T>[] = [];
  private readonly childrenSet: Set<ViewNode<T>> = new Set();

  get empty(): boolean {
    return this._children.length === 0;
  }

  get children(): readonly ViewNode<T>[] {
    return this._children;
  }

  get childCount(): number {
    return this._children.length;
  }

  hasChild(child: ViewNode<T>): boolean {
    return this.childrenSet.has(child);
  }

  addChild(...children: ViewNode<T>[]): void {
    for (const child of children) {
      if (this.childrenSet.has(child)) continue;
      this._children.push(child);
      this.registerChild(child);
    }
  }

  setChildren(...children: ViewNode<T>[]): void {
    const incomingSet = new Set(children);
    const abandoned = this.childrenSet.difference(incomingSet);
    this.removeMany(abandoned);

    // All abandoned are removed, let's just re-order and register any that
    // are not yet added.
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      this._children[i] = child;
      if (!this.hasChild(child)) {
        this.registerChild(child);
      }
    }
    this._children.length = children.length;
  }

  removeChild(child: ViewNode<T>): ViewNode<T> | null {
    if (!this.childrenSet.has(child)) {
      return null;
    }

    this._children.splice(this._children.indexOf(child));
    this.unregisterChild(child);
    return child;
  }

  removeMany(children: Iterable<ViewNode<T>>): void {
    if (!this.childrenSet.size) {
      return;
    }
    removeManyInPlace(this._children, new Set(children));
    for (const child of children) {
      this.unregisterChild(child);
    }
  }

  clear(): void {
    for (const child of this._children) {
      this.removeChild(child);
    }
  }

  private registerChild(child: ViewNode<T>): void {
    this.childrenSet.add(child);
    child.reparentTo(this);
  }

  private unregisterChild(child: ViewNode<T>): void {
    this.childrenSet.delete(child);
    child.remove();
  }

  override dispose(): void {
    if (this.disposed) return;
    this.reset();
    this._disposed = true;
  }

  reset(): void {
    coreLog.verbose('DisposingViewElementNode', {
      childCount: this.childCount,
    });
    for (let i = 0; i < this._children.length; i++) {
      this._children[i].dispose();
    }
    this._children.length = 0;
    this.childrenSet.clear();
  }
}
