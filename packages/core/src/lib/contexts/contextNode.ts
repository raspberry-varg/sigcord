export const CONTEXT_NOT_FOUND: unique symbol = Symbol('Context not found');

export class ContextNode {
  constructor(
    readonly parent: ContextNode | undefined,
    private readonly id?: symbol,
    private readonly value?: unknown,
  ) {}

  /**
   * Retrieve a value from the context. Recurses up the context tree in an
   * attempt to retrieve it if this current node does not have one.
   *
   * @param id
   */
  get(id: symbol): unknown | typeof CONTEXT_NOT_FOUND {
    if (this.id === id) {
      return this.value;
    }
    if (this.parent) {
      return this.parent.get(id);
    }
    return CONTEXT_NOT_FOUND;
  }
}
