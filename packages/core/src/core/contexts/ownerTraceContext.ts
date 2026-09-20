import { createInternalContext } from './createInternalContext.js';

/**
 * @internal
 */
export const OwnerTraceContext = createInternalContext<OwnerTraceNode>('OwnerTrace');

/**
 * @internal
 */
export enum OwnerTraceType {
  Component = 'component',
  ControlFlow = 'controlFlow',
  Primitive = 'primitive',
  Handler = 'handler',
}

/**
 * @internal
 */
export interface OwnerTraceNode {
  type: OwnerTraceType;
  name: string;
  details?: string;
}
