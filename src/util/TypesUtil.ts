export type MaybePromise<T> = T | Promise<T>;

// To whoever just Ctrl+Clicked, I'm so sorry for all this type mangling, but it works.
export type UnionToIntersection<U> = (
  U extends any ? (x: U) => void : never
) extends (x: infer I) => void
  ? I
  : never;
export type ArrayUnionToIntersection<U> = U extends Array<infer T>
  ? UnionToIntersection<T>
  : never;

// type AllProperties<Views extends View[]> = {
//   [K in keyof Views]: Views[K] extends View<infer Props>
//     ? Props
//     : never;
// };

// type AllPropertiesOfArray<Views extends ViewDefinitions> =
//   ArrayUnionToIntersection<AllProperties<Views>>;

// type ResolveAllPropertiesOf<Views extends ViewDefinitions> =
//   AllPropertiesOfArray<Views>;

// type AllPropertiesOf<Views extends ViewDefinitions> = ArrayUnionToIntersection<{
//   [K in keyof Views]: Views[K] extends View<infer Props> ? Props : PropsBase;
// }>;
