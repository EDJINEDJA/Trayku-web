type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type Logger = Record<Level, (message: string, ...extra: unknown[]) => void>;

export function createLogger(level: Level = (process.env.LOG_LEVEL as Level) || 'info'): Logger {
  const at = (l: Level) => (message: string, ...extra: unknown[]) => {
    if (ORDER[l] < ORDER[level]) return;
    const line = `${new Date().toISOString()} ${l.padEnd(5)} ${message}`;
    (l === 'error' ? console.error : l === 'warn' ? console.warn : console.log)(line, ...extra);
  };
  return { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}
