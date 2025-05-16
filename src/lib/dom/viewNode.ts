import type { ViewElementNode } from './viewElementNode.js';
import type { ViewNodeKind } from './viewNodeKind.js';

export abstract class ViewNode<T extends ViewNodeKind> implements Disposable {
  protected disposed_ = false;
  private parentInternal: ViewElementNode<T> | null = null;

  get disposed(): boolean {
    return this.disposed_;
  }

  get parent() {
    return this.parentInternal;
  }

  reparentTo(newParent: ViewElementNode<T>): void {
    if (this.parent === newParent) {
      return;
    }

    const oldParent = this.parent;
    oldParent?.removeChild(this);
    this.parentInternal = newParent;
    if (!newParent.hasChild(this)) {
      newParent.addChild(this);
    }
  }

  remove(): void {
    if (!this.parent) {
      return;
    }

    const oldParent = this.parent;
    this.parentInternal = null;
    if (oldParent.hasChild(this)) {
      this.parent.removeChild(this);
    }
  }

  abstract dispose(): void;

  [Symbol.dispose]() {
    this.dispose();
  }
}
