// TODO(@raspberry-varg): Use an actual logger
enum LogLevel {
  None = 0,
  Error = 1,
  Warn = 2,
  Info = 3,
  Debug = 4,
  Verbose = 5,
}

export const logLevel: LogLevel = Number(process.env.DIM_LOGGING_LEVEL || 0);

function shouldLog(level: LogLevel): boolean {
  return logLevel >= level;
}

export const logger = {
  verbose(msg: unknown, ...args: unknown[]) {
    if (shouldLog(LogLevel.Verbose)) {
      console.debug(msg, ...args);
    }
  },
  debug(msg: unknown, ...args: unknown[]) {
    if (shouldLog(LogLevel.Debug)) {
      console.debug(msg, ...args);
    }
  },
  info(msg: unknown, ...args: unknown[]) {
    if (shouldLog(LogLevel.Info)) {
      console.log(msg, ...args);
    }
  },
  warn(msg: unknown, ...args: unknown[]) {
    if (shouldLog(LogLevel.Warn)) {
      console.warn(msg, ...args);
    }
  },
  error(msg: unknown, ...args: unknown[]) {
    if (shouldLog(LogLevel.Error)) {
      console.error(msg, ...args);
    }
  },
};
