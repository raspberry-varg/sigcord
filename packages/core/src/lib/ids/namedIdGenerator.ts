export class NamedIdGenerator {
  private currentId = 0;

  constructor(
    readonly identifier: string,
    readonly namespace = 'anon',
  ) {}

  next(): string {
    return this.format(this.currentId++);
  }

  private format(id: number): string {
    return `%%${this.namespace}_${this.identifier}>${id}%%`;
  }
}
