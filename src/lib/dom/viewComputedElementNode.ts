import { ViewElementNode } from './viewElementNode.js';
import type { BaseViewNodeKind, ViewNodeKind } from './viewNodeKind.js';
import type { EmbedBuilder } from 'discord.js';
import type { ViewComponent } from '../MenuView.js';
import { owner } from '../render/owner.js';

export type NodeContentComputer<
  T extends BaseViewNodeKind,
  U extends BaseViewNodeKind,
> = (content: T[]) => U | U[] | false | null | undefined;

type ToBase<T extends BaseViewNodeKind> = T extends EmbedBuilder
  ? EmbedBuilder
  : T extends ViewComponent
    ? ViewComponent
    : never;

export class ViewComputedElementNode<
  T extends ViewNodeKind,
> extends ViewElementNode<T> {
  constructor(
    readonly computer: NodeContentComputer<
      Extract<T, BaseViewNodeKind>,
      ToBase<Extract<T, BaseViewNodeKind>>
    >,
  ) {
    super();
  }
}

export function elementComputed<
  T extends BaseViewNodeKind,
  U extends BaseViewNodeKind,
>(
  computer: NodeContentComputer<T, U>,
  content: () => ViewNodeKind<T>[],
): ViewComputedElementNode<T> {
  const node = new ViewComputedElementNode<T>(computer as any);
  const o = owner<T>(content);
  node.addChild(o.root);
  return node;
}
