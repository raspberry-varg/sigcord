import { describe, expect, expectTypeOf, test } from 'bun:test';
import type { Context } from './context.js';
import { provideContextValue, provideRootContext } from './provideContext.js';
import { useContext } from './useContext.js';

const numberContext: Context<number | undefined> = {
  id: Symbol('NumberContext'),
  default: undefined,
};

const stringContext: Context<string | undefined> = {
  id: Symbol('StringContext'),
  default: undefined,
};

const objectContext: Context<{ name: string } | undefined> = {
  id: Symbol('ObjectContext'),
  default: undefined,
};

const objectContextWithDefault: Context<{ name: string }> = {
  id: Symbol('ObjectContext'),
  default: { name: 'default name' },
};

const nullContext: Context<null> = {
  id: Symbol('NullContext'),
  default: null,
};

const undefinedContext: Context<undefined> = {
  id: Symbol('UndefinedContext'),
  default: undefined,
};

const falseContext: Context<false> = {
  id: Symbol('FalseContext'),
  default: false,
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

  test('returns default value', () => {
    provideRootContext(() => {
      expect(useContext(objectContextWithDefault)).toEqual({
        name: 'default name',
      });
    });
  });

  test('does not return default when the context is provided', () => {
    provideContextValue(
      objectContextWithDefault,
      { name: 'Spike Minoda' },
      () => {
        expect(useContext(objectContextWithDefault)).toEqual({
          name: 'Spike Minoda',
        });
      },
    );
  });

  describe('falsy values', () => {
    test('gets empty string from context', () => {
      provideContextValue(stringContext, '', () => {
        expect(useContext(stringContext)).toBe('');
      });
    });

    test('gets 0 from context', () => {
      provideContextValue(numberContext, 0, () => {
        expect(useContext(numberContext)).toBe(0);
      });
    });

    test('gets false from context', () => {
      provideContextValue(falseContext, false, () => {
        expect(useContext(falseContext)).toBe(false);
      });
    });

    test('gets null from context', () => {
      provideContextValue(nullContext, null, () => {
        expect(useContext(nullContext)).toBe(null);
      });
    });

    test('gets undefined from context', () => {
      provideContextValue(undefinedContext, undefined, () => {
        expect(useContext(undefinedContext)).toBe(undefined);
      });
    });
  });

  describe('types', () => {
    test('is potentially undefined when no default is declared', () => {
      expectTypeOf(() => useContext(objectContext)).returns.toEqualTypeOf<
        { name: string } | undefined
      >();
    });

    test('is not undefined when a default is declared', () => {
      expectTypeOf(() =>
        useContext(objectContextWithDefault),
      ).returns.toEqualTypeOf<{ name: string }>();
    });
  });
});
