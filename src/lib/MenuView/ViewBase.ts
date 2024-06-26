import type { MaybePromise } from '../../util/TypesUtil.js';

export type PropsBase = NonNullable<unknown>;
export interface ViewDefinitionBase {
  readonly id: string;
  /** If true, this view cannot be an initial view and must be swapped into. */
  isSubView?: boolean;
  onSwap?: (...args: any[]) => MaybePromise<void>;
}
