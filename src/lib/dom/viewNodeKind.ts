import type {
  Children,
  EmbedComponent,
  ViewComponent,
} from '../views/viewFlavors.js';

export type ViewNodeKind<T extends BaseViewNodeKind = BaseViewNodeKind> =
  | T
  | Children<T>;

export type BaseViewNodeKind = EmbedComponent | ViewComponent;
