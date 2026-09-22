import type { Children, EmbedComponent, ViewComponent } from '../views/viewFlavors.js';
import type { Primitive } from './props.js';

export type ViewNodeKind<T extends ViewNodeKindBase = ViewNodeKindBase> = T | Children<T>;

export type ViewNodeKindBase = EmbedComponent | ViewComponent | Primitive;
