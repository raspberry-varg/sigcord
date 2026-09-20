import { getConfig } from '../../config.js';
import { extractOwnContext } from '../../lib/contexts/useContext.js';
import { OwnerTraceContext, OwnerTraceType } from '../contexts/ownerTraceContext.js';

import type { Owner } from '../../lib/owners/owner.js';

const COMPONENT_STACK_APPLIED = Symbol('__sigcord.component_stack_applied');

export function enhanceErrorWithComponentStack(error: unknown, errorOwner: Owner | null): unknown {
  if (!getConfig().componentStacks) {
    return error;
  }

  if (!error || typeof error !== 'object' || (error as WithEnhancement).ownerStackApplied) {
    return error;
  }

  if (!errorOwner || !(error instanceof Error)) {
    return error;
  }

  const traceLines: string[] = [];
  for (
    let currentOwner: Owner | null = errorOwner;
    currentOwner != null;
    currentOwner = currentOwner.parent
  ) {
    const trace = extractOwnContext(currentOwner, OwnerTraceContext);
    if (!trace) {
      continue;
    }

    const details = trace.details ? ` (${trace.details})` : '';
    switch (trace.type) {
      case OwnerTraceType.Component:
        traceLines.push(`<${trace.name}${details}>`);
        break;
      case OwnerTraceType.ControlFlow:
        traceLines.push(`{${trace.name}${details}}`);
        break;
      case OwnerTraceType.Primitive:
        traceLines.push(`[${trace.name}${details}]`);
        break;
      case OwnerTraceType.Handler:
        traceLines.push(`ƒ ${trace.name}${details}`);
        break;
    }
  }

  if (traceLines.length > 0) {
    const stackString = `\n\nSigcord Owner Stack:\n  at ${traceLines.join('\n  at ')}`;
    error.stack = (error.stack || error.message) + stackString;
    error.message += stackString;
  }

  return Object.defineProperty(error, COMPONENT_STACK_APPLIED, {
    value: true,
    enumerable: false, // Keeps console.log clean
    writable: false,
    configurable: false,
  });
}

interface WithEnhancement {
  ownerStackApplied?: boolean;
}
