import { ViewProps } from '../FunctionalMenuView.js';

import type { ReactiveViewPayload } from '../MenuView.js';
import type { PropsBase, ViewDefinitionBase } from './ViewBase.js';

export type ReactiveView<Props extends PropsBase> =
  | (() => ReactiveViewPayload)
  | ((props: ViewProps<Props>) => ReactiveViewPayload);

export type ReactiveViewBody = ReactiveViewPayload;
export type ReactiveViewInstance = ViewDefinitionBase & ReactiveViewBody;
