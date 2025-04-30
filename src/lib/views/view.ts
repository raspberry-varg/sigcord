import type { ClassViewDefinition } from '../FunctionalMenuView.js';
import type { MenuFactory } from '../InteractiveMenu.js';
import type { ClassicViewInstance } from './classic/classViewInstance.js';
import type { ReactiveViewInstance } from '../MenuView/ReactiveView.js';
import type { PropsBase } from '../MenuView/ViewBase.js';
import type { ReactiveViewDefinition } from './reactive/reactiveViewDefinition.js';

export type DefinedView<Props extends PropsBase = PropsBase> =
  MenuFactory<Props> & View<Props>;

export type View<Props extends PropsBase = PropsBase> =
  | ClassViewDefinition<Props>
  | ReactiveViewDefinition<Props>;

export type ViewInstance =
  | ClassicViewInstance<PropsBase>
  | ReactiveViewInstance;
