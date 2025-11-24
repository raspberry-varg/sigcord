import { ViewElementNode } from './viewElementNode.js';
import type { BaseViewNodeKind, ViewNodeKind } from './viewNodeKind.js';
import { owner } from '../render/owner.js';
import type { Children, Primitive } from '../views/viewFlavors.js';

export type NodeContentComputer<T, U extends ViewNodeKind> = (
  content: T,
) => U | Children<U>;

export class ViewComputedElementNode<
  T_IN,
  T_OUT extends ViewNodeKind,
> extends ViewElementNode<T_OUT> {
  constructor(readonly computer: NodeContentComputer<T_IN, T_OUT>) {
    super();
  }
}

export function elementComputed<
  T_SOURCE extends Array<BaseViewNodeKind | Primitive>,
  T_OUT extends ViewNodeKind,
>(
  computer: NodeContentComputer<T_SOURCE, T_OUT>,
  content: () => T_SOURCE,
): ViewComputedElementNode<T_SOURCE, T_OUT> {
  const node = new ViewComputedElementNode<T_SOURCE, T_OUT>(computer);
  const o = owner<T_SOURCE[number]>(content);
  node.addChild(o.root);
  return node;
}
