import type { ViewClassImplementation } from '../../MenuView/DefineClassicView.js';
import type { PropsBase } from '../../MenuView/ViewBase.js';

export interface ClassViewDefinitionBody<Props extends PropsBase = PropsBase> {
  class: ViewClassImplementation<Props>;
}
