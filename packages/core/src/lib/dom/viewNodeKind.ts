import type {
  Children,
  EmbedComponent,
  Primitive,
  ViewComponent,
} from '../views/viewFlavors.js';

export type ViewNodeKind<T extends ViewNodeKindBase = ViewNodeKindBase> =
  | T
  | Children<T>;

export type ViewNodeKindBase = EmbedComponent | ViewComponent | Primitive;
