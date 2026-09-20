import { getConfig } from '../../config.js';
import { OwnerTraceContext, OwnerTraceType } from '../../core/contexts/ownerTraceContext.js';
import { enhanceErrorWithComponentStack } from '../../core/utils/errorStack.js';
import { coreLog } from '../../internal/coreLog.js';
import { provideContextValue } from '../contexts/provideContext.js';
import { createOwner, getOwner, runWithOwner } from '../owners/owner.js';

export class DeferredComponent<T_RET, T_PROPS extends NonNullable<unknown> = NonNullable<unknown>> {
  constructor(
    private readonly fn: (props: T_PROPS) => T_RET,
    private readonly props: NoInfer<T_PROPS>,
  ) {}

  execute(): T_RET {
    if (!getConfig().componentStacks) {
      return this.fn(this.props);
    }

    const componentOwner = createOwner(getOwner());
    return runWithOwner(componentOwner, () => {
      provideContextValue(OwnerTraceContext, {
        type: OwnerTraceType.Component,
        name: this.fn.name || 'AnonymousComponent',
      });
      try {
        return this.fn(this.props);
      } catch (e: unknown) {
        coreLog.error(
          'Error occurred while executing deferred component, enhancing error stack',
          e,
        );
        throw enhanceErrorWithComponentStack(e, componentOwner);
      }
    });
  }
}
