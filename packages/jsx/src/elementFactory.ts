import { createDeferredNode, h, type IntrinsicPropsMap } from '@sigcord/core';

import { JSXElement } from './index.js';
import { type Attributes, fragmentFactory, type FunctionalComponent } from './jsx-runtime.js';

export function elementFactory<T extends string | FunctionalComponent | undefined>(
  tagName: T,
  props?: Attributes,
): JSXElement | JSXElement[] {
  if (tagName == null) {
    return props?.children ?? undefined;
  }
  if (tagName === (fragmentFactory as any)) {
    return (tagName as unknown as typeof fragmentFactory)(props ?? {});
  }

  if (typeof tagName === 'function') {
    return createDeferredNode(tagName, props);
  }

  if (typeof tagName === 'string') {
    return h(tagName as keyof IntrinsicPropsMap, (props as Record<string, unknown>) ?? {});
  }

  return null;
}
