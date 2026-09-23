import { getConfig } from '../../config.js';
import { OwnerTraceContext, OwnerTraceType } from '../../core/contexts/ownerTraceContext.js';
import { enhanceErrorWithComponentStack } from '../../core/utils/errorStack.js';
import { coreLog } from '../../internal/coreLog.js';
import { provideContextValue } from '../contexts/provideContext.js';
import { extractContext, useContext } from '../contexts/useContext.js';
import { createOwner, getOwner, getOwnerOrThrow, runWithOwner } from '../owners/owner.js';

export class DeferredComponentLegacy<
  T_RET,
  T_PROPS extends NonNullable<unknown> = NonNullable<unknown>,
> {
  private readonly capturedOwner = createOwner(getOwner());
  constructor(
    private readonly fn: (props: T_PROPS) => T_RET,
    private readonly props: NoInfer<T_PROPS>,
  ) {
    console.log('! INITIALIZED A NEW DEFERRED COMPONENT', {
      fn: this.fn.name,
      capturedOwnerStackTrace: extractContext(this.capturedOwner, OwnerTraceContext),
    });
  }

  execute(): T_RET {
    console.log('executing deferred component:', {
      name: this.fn.name,
      ownerStackTrace: extractContext(getOwnerOrThrow(), OwnerTraceContext),
    });
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
        console.log(
          `>>> Executing ${this.fn.name} with the context value`,
          useContext(OwnerTraceContext),
        );
        return this.fn(this.props);
      } catch (e: unknown) {
        coreLog.error('Error occurred while executing deferred component, enhancing error stack');
        throw enhanceErrorWithComponentStack(e, componentOwner);
      } finally {
        console.log('>> DONE, exiting');
      }
    });
  }
}
