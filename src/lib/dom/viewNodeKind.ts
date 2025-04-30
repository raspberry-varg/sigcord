import type { Children, EmbedComponent, ViewComponent } from '../MenuView.js';

export type ViewNodeKind =
  | EmbedComponent
  | ViewComponent
  | Children<EmbedComponent | ViewComponent>;
