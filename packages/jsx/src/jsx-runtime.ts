import { type IntrinsicPropsMap, type ViewNode } from '@sigcord/core';

import { elementFactory } from './jsx-runtime.js';

import JSXNode = JSX.JSXNode;

export type FunctionalComponent = (props: Record<string, unknown>) => JSX.Element;

export type Attributes = Record<string, JSX.JSXNode | undefined> & JSXChildren;

export { elementFactory } from './elementFactory.js';

export const fragmentFactory = (props: JSXChildren): JSXNode[] => {
  if (!props.children) {
    return [];
  }
  return Array.isArray(props.children) ? props.children : [props.children];
};

export declare namespace JSX {
  interface IntrinsicElements extends IntrinsicPropsMap {}

  type Element = JSXNode;
  type JSXNode = ViewNode | ViewNode[];

  interface ElementChildrenAttribute {
    children: {};
  }
}

export interface JSXChildren {
  children?: JSXNode | JSXNode[] | undefined;
}

export const jsx = elementFactory;
export const jsxs = elementFactory;
export const jsxDEV = elementFactory;
export const Fragment = fragmentFactory;
