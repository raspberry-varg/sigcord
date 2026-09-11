import { logger } from '../../util/Logger.js';
import { ViewNode } from './viewNode.js';
import type { ViewNodeKind } from './viewNodeKind.js';
import { removeManyInPlace } from '../../util/arrays/removeManyInPlace.js';

export class ViewElementNode<T extends ViewNodeKind> extends ViewNode<T> {
  private readonly children_: ViewNode<T>[] = [];
  private readonly childrenSet: Set<ViewNode<T>> = new Set();

  get empty(): boolean {
    return this.children_.length === 0;
  }

  get children(): readonly ViewNode<T>[] {
    return this.children_;
  }

  get childCount(): number {
    return this.children_.length;
  }

  hasChild(child: ViewNode<T>): boolean {
    return this.childrenSet.has(child);
  }

  addChild(...children: ViewNode<T>[]): void {
    for (const child of children) {
      if (this.childrenSet.has(child)) continue;
      this.children_.push(child);
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
      this.children_[i] = child;
      if (!this.hasChild(child)) {
        this.registerChild(child);
      }
    }
    this.children_.length = children.length;
  }

  removeChild(child: ViewNode<T>): ViewNode<T> | null {
    if (!this.childrenSet.has(child)) {
      return null;
    }

    this.children_.splice(this.children_.indexOf(child));
    this.unregisterChild(child);
    return child;
  }

  removeMany(children: Iterable<ViewNode<T>>): void {
    if (!this.childrenSet.size) {
      return;
    }
    removeManyInPlace(this.children_, new Set(children));
    for (const child of children) {
      this.unregisterChild(child);
    }
  }

  clear(): void {
    for (const child of this.children_) {
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
    this.disposed_ = true;
  }

  reset(): void {
    logger.verbose('DisposingViewElementNode', { childCount: this.childCount });
    for (let i = 0; i < this.children_.length; i++) {
      this.children_[i].dispose();
    }
    this.children_.length = 0;
    this.childrenSet.clear();
  }
}
