import type { MaybePromise } from '../../../util/types.js';
import type { PropsBase } from '../viewDefinitionBase.js';
import type { ViewMessagePayload } from '../viewFlavors.js';
import type { ClassViewProps } from './functionalClassViewDefinition.js';

export type ViewRender<Props extends PropsBase = PropsBase> =
  | (() => MaybePromise<ViewMessagePayload>)
  | ((props: ClassViewProps<Props>) => MaybePromise<ViewMessagePayload>);
