import { ViewElementNode } from './viewElementNode.js';
import type { ViewNodeKindBase } from './viewNodeKind.js';
import type { Children } from '../views/viewFlavors.js';
import { render } from '../render/render.js';

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
  render<T_SOURCE[number]>(node, content);
  return node;
}
