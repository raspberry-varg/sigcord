// TODO(@raspberry-varg): Use an actual logger
export const logger = {
  debug(msg: unknown, ...args: unknown[]) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(msg, ...args);
    }
  },
  error(msg: unknown, ...args: unknown[]) {
    if (process.env.NODE_ENV === 'development') {
      console.error(msg, ...args);
    }
  },
  warn(msg: unknown, ...args: unknown[]) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(msg, ...args);
    }
  },
};
