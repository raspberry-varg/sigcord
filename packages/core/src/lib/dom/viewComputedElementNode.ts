import { ViewElementNode } from './viewElementNode.js';
import type { ViewNodeKindBase } from './viewNodeKind.js';
import { owner } from '../render/owner.js';
import type { Children } from '../views/viewFlavors.js';

export type NodeContentComputer<T, U extends ViewNodeKindBase> = (
  content: T,
) => U | Children<U>;

export class ViewComputedElementNode<
  T_IN,
  T_OUT extends ViewNodeKindBase,
> extends ViewElementNode<T_OUT> {
  constructor(readonly computer: NodeContentComputer<T_IN, T_OUT>) {
    super();
  }
}

export function elementComputed<
  T_SOURCE extends Array<ViewNodeKindBase>,
  T_OUT extends ViewNodeKindBase,
>(
  computer: NodeContentComputer<T_SOURCE, T_OUT>,
  content: () => T_SOURCE,
): ViewComputedElementNode<T_SOURCE, T_OUT> {
  const node = new ViewComputedElementNode<T_SOURCE, T_OUT>(computer);
  const o = owner<T_SOURCE[number]>(content);
  node.addChild(o.root);
  return node;
}
