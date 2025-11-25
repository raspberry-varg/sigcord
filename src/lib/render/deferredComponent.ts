export class DeferredComponent<
  T_RET,
  T_PROPS extends NonNullable<unknown> = NonNullable<unknown>,
> {
  constructor(
    private readonly fn: (props: T_PROPS) => T_RET,
    private readonly props: NoInfer<T_PROPS>,
  ) {}

  execute(): T_RET {
    return this.fn(this.props);
  }
}
