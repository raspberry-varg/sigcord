export const CONTEXT_NOT_FOUND: unique symbol = Symbol('Context not found');

export class ContextNode {
  constructor(
    readonly parent: ContextNode | undefined,
    private readonly idToValues: Readonly<Record<symbol, unknown>>,
  ) {}

  /**
   * Retrieve a value from the context. Recurses up the context tree in an
   * attempt to retrieve it if this current node does not have one.
   *
   * @param id
   */
  get(id: symbol): unknown | typeof CONTEXT_NOT_FOUND {
    if (id in this.idToValues) {
      return this.idToValues[id];
    }
    if (this.parent) {
      return this.parent.get(id);
    }
    return CONTEXT_NOT_FOUND;
  }
}
