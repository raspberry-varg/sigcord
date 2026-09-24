import { getConfig } from '../../config.js';
import { OwnerTraceContext, OwnerTraceType } from '../../core/contexts/ownerTraceContext.js';
import { enhanceErrorWithComponentStack } from '../../core/utils/errorStack.js';
import { coreLog } from '../../internal/coreLog.js';
import { provideContextValue } from '../contexts/provideContext.js';
import { createOwner, getOwner, runWithOwner } from '../owners/owner.js';

export class DeferredComponentLegacy<
  T_RET,
  T_PROPS extends NonNullable<unknown> = NonNullable<unknown>,
> {
  private readonly capturedOwner = createOwner(getOwner());
  constructor(
    private readonly fn: (props: T_PROPS) => T_RET,
    private readonly props: NoInfer<T_PROPS>,
  ) {}

  execute(): T_RET {
    if (!getConfig().componentStacks) {
      return this.fn(this.props);
    }

    const componentOwner = createOwner(this.capturedOwner);
    return runWithOwner(componentOwner, () => {
      provideContextValue(OwnerTraceContext, {
        type: OwnerTraceType.Component,
        name: this.fn.name || 'AnonymousComponent',
      });
      try {
        return this.fn(this.props);
      } catch (e: unknown) {
        coreLog.error('Error occurred while executing deferred component, enhancing error stack');
        throw enhanceErrorWithComponentStack(e, componentOwner);
      }
    });
  }
}
