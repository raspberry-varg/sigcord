// TODO(@raspberry-varg): Use an actual logger
export const debug = process.env.NODE_ENV === 'development';
export const verbose = process.env.VERBOSE === 'true';
export const logger = {
  verbose(msg: unknown, ...args: unknown[]) {
    if (verbose) {
      console.debug(msg, ...args);
    }
  },
  debug(msg: unknown, ...args: unknown[]) {
    if (debug) {
      console.debug(msg, ...args);
    }
  },
  error(msg: unknown, ...args: unknown[]) {
    if (debug) {
      console.error(msg, ...args);
    }
  },
  warn(msg: unknown, ...args: unknown[]) {
    if (debug) {
      console.warn(msg, ...args);
    }
  },
};
