import { describe, expect, test } from 'bun:test';
import { CONTEXT_NOT_FOUND, ContextNode } from './contextNode.js';
import type { Context } from './context.js';

const CONTEXT_A: Context<number | undefined> = {
  id: Symbol('ContextA'),
  default: undefined,
};

describe('ContextNode', () => {
  test('returns value it contains', () => {
    const context = new ContextNode(undefined, CONTEXT_A.id, 5);
    expect(context.get(CONTEXT_A.id)).toBe(5);
  });

  test('returns not found value when an id is not present', () => {
    const context = new ContextNode(undefined);
    expect(context.get(CONTEXT_A.id)).toBe(CONTEXT_NOT_FOUND);
  });

  test('returns a value from its parent', () => {
    const parent = new ContextNode(undefined, CONTEXT_A.id, 5);
    const child = new ContextNode(parent);
    expect(child.get(CONTEXT_A.id)).toBe(5);
  });

  test('returns the closest value', () => {
    const parent = new ContextNode(undefined, CONTEXT_A.id, 5);
    const child = new ContextNode(parent, CONTEXT_A.id, 10);

    expect(child.get(CONTEXT_A.id)).toBe(10);
    expect(parent.get(CONTEXT_A.id)).toBe(5);
  });
});
