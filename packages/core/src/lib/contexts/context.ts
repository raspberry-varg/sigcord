export interface Context<T> {
  id: symbol;
  default?: T;
}
