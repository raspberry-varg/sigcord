import type { ViewClassImplementation } from './defineClassicView.js';
import type { PropsBase } from '../viewDefinitionBase.js';

export interface ClassViewDefinitionBody<Props extends PropsBase = PropsBase> {
  class: ViewClassImplementation<Props>;
}
