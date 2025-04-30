import { logger } from '../../util/Logger.js';
import { ViewNode } from './viewNode.js';
import type { ViewNodeKind } from './viewNodeKind.js';

export class ViewContentNode<T extends ViewNodeKind> extends ViewNode<T> {
  private content?: T;

  constructor(initialVal?: T) {
    super();
    this.content = initialVal;
  }

  getContent(): T | undefined {
    return this.content;
  }

  setContent(newContent: T | undefined): void {
    this.content = newContent;
  }

  override dispose(): void {
    if (this.disposed) return;

    logger.debug('Disposing ViewContentNode', { content: this.content });
    this.content = undefined;
  }
}
