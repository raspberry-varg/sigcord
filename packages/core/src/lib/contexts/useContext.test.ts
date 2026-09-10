import { describe, expect, test } from 'bun:test';
import type { Context } from './context.js';
import { provideContextValue } from './provideContext.js';
import { useContext, useContextStrict } from './useContext.js';

const numberContext: Context<number> = {
  id: Symbol('NumberContext'),
};

const stringContext: Context<string> = {
  id: Symbol('StringContext'),
};

const nullContext: Context<null> = {
  id: Symbol('NullContext'),
};

const undefinedContext: Context<undefined> = {
  id: Symbol('UndefinedContext'),
};

const falseContext: Context<false> = {
  id: Symbol('FalseContext'),
};

describe('useContext', () => {
  test('gets value from context', () => {
    provideContextValue(numberContext, 5, () => {
      expect(useContext(numberContext)).toBe(5);
    });
  });

  test('gets value from nested context', () => {
    provideContextValue(numberContext, 5, () => {
      provideContextValue(stringContext, 'foo', () => {
        expect(useContext(numberContext)).toBe(5);
        expect(useContext(stringContext)).toBe('foo');
      });
    });
  });
});

describe('useContextStrict', () => {
  test('gets value from context', () => {
    provideContextValue(numberContext, 5, () => {
      expect(useContextStrict(numberContext)).toBe(5);
    });
  });

  test('throws when a value is not found', () => {
    provideContextValue(numberContext, 5, () => {
      expect(() => useContextStrict(stringContext)).toThrow();
    });
  });
});

describe.each([
  { suffix: 'strict', strict: true },
  { suffix: '', strict: false },
])('useContext$strict', ({ strict }) => {
  const use = strict ? useContextStrict : useContext;

  describe('falsy values', () => {
    test('gets false from context', () => {
      provideContextValue(falseContext, false, () => {
        expect(use(falseContext)).toBe(false);
      });
    });

    test('gets null from context', () => {
      provideContextValue(nullContext, null, () => {
        expect(use(nullContext)).toBe(null);
      });
    });

    test('gets undefined from context', () => {
      provideContextValue(undefinedContext, undefined, () => {
        expect(use(undefinedContext)).toBe(undefined);
      });
    });
  });
});
