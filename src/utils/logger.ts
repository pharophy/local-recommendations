type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export function createLogger(level: LogLevel): Logger {
  const shouldLog = (candidate: LogLevel) => PRIORITY[candidate] >= PRIORITY[level];

  const log =
    (candidate: LogLevel) => (message: string, context: Record<string, unknown> = {}) => {
      if (!shouldLog(candidate)) {
        return;
      }

      const payload = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
      const line = `[${new Date().toISOString()}] ${candidate.toUpperCase()} ${message}${payload}`;
      if (candidate === 'error') {
        console.error(line);
      } else if (candidate === 'warn') {
        console.warn(line);
      } else {
        console.log(line);
      }
    };

  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  };
}
