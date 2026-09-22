// oxlint-disable no-underscore-dangle
import { isVDOMNode, NodeType } from './types.js';

export function disposeNode(node: unknown): void {
  if (node == null || typeof node === 'boolean') {
    return;
  }

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      disposeNode(node[i]);
    }
  }

  if (!isVDOMNode(node)) {
    return;
  }

  switch (node.$$typeof) {
    case NodeType.Deferred:
      if (node._resolvedContent) {
        const content = Array.isArray(node._resolvedContent)
          ? node._resolvedContent
          : [node._resolvedContent];
        for (let i = 0; i < content.length; i++) {
          const child = content[i];
          if (isVDOMNode(child)) {
            disposeNode(child);
          }
        }
        node._resolvedContent = undefined;
      }
      break;
    case NodeType.Boundary:
      disposeNode(node.children);
      break;
    case NodeType.Intrinsic:
      break;
    default:
      throw new Error(`Unhandled node type: ${node satisfies never}`);
  }
}
