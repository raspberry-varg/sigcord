import { getConfig } from '../../config.js';
import { extractOwnContext } from '../../lib/contexts/useContext.js';
import {
  OwnerTraceContext,
  type OwnerTraceNode,
  OwnerTraceType,
} from '../contexts/ownerTraceContext.js';

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

  const rawTrace: OwnerTraceNode[] = [];
  for (
    let currentOwner: Owner | null = errorOwner;
    currentOwner != null;
    currentOwner = currentOwner.parent
  ) {
    const trace = extractOwnContext(currentOwner, OwnerTraceContext);
    if (trace) {
      rawTrace.push(trace);
    }
  }

  if (rawTrace.length > 0) {
    const stackString = `\n\n${formatSigcordError(error.message, rawTrace, error.stack ?? '')}`;
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

// ANSI Color Codes
const c = {
  cyan: (t: string) => `\x1b[36m${t}\x1b[0m`,
  yellow: (t: string) => `\x1b[33m${t}\x1b[0m`,
  green: (t: string) => `\x1b[32m${t}\x1b[0m`,
  dim: (t: string) => `\x1b[90m${t}\x1b[0m`,
  red: (t: string) => `\x1b[31m${t}\x1b[0m`,
  reset: '\x1b[0m',
};

function formatTraceNode(node: OwnerTraceNode): string {
  const details = node.details ? c.dim(` (${node.details})`) : '';

  switch (node.type) {
    case OwnerTraceType.Component:
      return c.cyan(`<${node.name}>`) + details;
    case OwnerTraceType.ControlFlow:
      return c.yellow(`{${node.name}}`) + details;
    case OwnerTraceType.Handler:
      return c.green(`ƒ ${node.name}`) + details;
    default:
      return `[${node.name}]` + details;
  }
}

function formatSigcordError(message: string, rawTrace: OwnerTraceNode[], nodeStack: string) {
  // Component stack trace
  const componentLines = rawTrace.map((node) => `    at ${formatTraceNode(node)}`).join('\n');

  // Filter out framework internals
  const cleanedNodeStack = nodeStack
    .split('\n')
    .filter((line) => !line.includes('sigcord/packages/core/dist') && !line.includes('async_hooks'))
    .join('\n');

  return `
${c.red('Sigcord Error:')} ${message}

${c.dim('--- Component Stack ---')}
${componentLines}

${c.dim('--- Execution Stack ---')}
${cleanedNodeStack}
`;
}
