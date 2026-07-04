import type { MaybePromise } from '../../../util/TypesUtil.js';
import type { ClassViewProps } from '../../FunctionalMenuView.js';
import type { ViewMessagePayload } from '../viewFlavors.js';
import type { PropsBase } from '../viewDefinitionBase.js';

export type ViewRender<Props extends PropsBase = PropsBase> =
  | (() => MaybePromise<ViewMessagePayload>)
  | ((props: ClassViewProps<Props>) => MaybePromise<ViewMessagePayload>);
