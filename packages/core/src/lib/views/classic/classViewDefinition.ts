import type { PropsBase } from "../viewDefinitionBase.js";
import type { ViewClassImplementation } from "./defineClassicView.js";

export interface ClassViewDefinitionBody<Props extends PropsBase = PropsBase> {
  class: ViewClassImplementation<Props>;
}
