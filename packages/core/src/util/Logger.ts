// TODO(@raspberry-varg): Use an actual logger
export enum LogLevel {
  None = 0,
  Error = 1,
  Warn = 2,
  Info = 3,
  Debug = 4,
  Verbose = 5,
}

export const logLevel: LogLevel = Number(
  process.env.DIM_LOGGING_LEVEL || LogLevel.None,
);

export function shouldLog(level: LogLevel): boolean {
  return logLevel >= level;
}

export class Logger {
  constructor(private readonly ns: string = '') {
    this.ns = ns;
  }

  static namespaced(ns: string): Logger {
    return new Logger(ns);
  }

  verbose(msg: unknown, ...args: unknown[]) {
    if (shouldLog(LogLevel.Verbose)) {
      console.debug(this.ns ? `[${this.ns}]` : '', msg, ...args);
    }
  }
  debug(msg: unknown, ...args: unknown[]) {
    if (shouldLog(LogLevel.Debug)) {
      console.debug(this.ns ? `[${this.ns}]` : '', msg, ...args);
    }
  }
  info(msg: unknown, ...args: unknown[]) {
    if (shouldLog(LogLevel.Info)) {
      console.log(this.ns ? `[${this.ns}]` : '', msg, ...args);
    }
  }
  warn(msg: unknown, ...args: unknown[]) {
    if (shouldLog(LogLevel.Warn)) {
      console.warn(this.ns ? `[${this.ns}]` : '', msg, ...args);
    }
  }
  error(msg: unknown, ...args: unknown[]) {
    if (shouldLog(LogLevel.Error)) {
      console.error(this.ns ? `[${this.ns}]` : '', msg, ...args);
    }
  }
}

export const logger = new Logger();
