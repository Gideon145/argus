export interface Logger {
  info(msg: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
  debug(msg: string, ...args: any[]): void;
}

export function createLogger(prefix: string): Logger {
  const ts = () => new Date().toISOString();
  return {
    info: (msg, ...args) => console.log(`[${ts()}] [${prefix}] INFO  ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[${ts()}] [${prefix}] WARN  ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[${ts()}] [${prefix}] ERROR ${msg}`, ...args),
    debug: (msg, ...args) => {
      if (process.env.DEBUG) console.log(`[${ts()}] [${prefix}] DEBUG ${msg}`, ...args);
    },
  };
}
