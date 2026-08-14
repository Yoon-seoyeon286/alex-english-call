export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  at: number;
  level: LogLevel;
  scope: string;
  message: string;
}

type Listener = (entries: LogEntry[]) => void;

const MAX_ENTRIES = 300;

let nextId = 1;
let entries: LogEntry[] = [];
const listeners = new Set<Listener>();

/**
 * Ring-buffer logger. Everything also goes to console so `adb logcat` picks it
 * up, but keeping a copy in memory lets the call screen show what happened
 * without a cable attached.
 */
function push(level: LogLevel, scope: string, args: unknown[]): void {
  const message = args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');

  const entry: LogEntry = { id: nextId++, at: Date.now(), level, scope, message };
  entries = [...entries.slice(-(MAX_ENTRIES - 1)), entry];

  const line = `[${scope}] ${message}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);

  listeners.forEach((l) => l(entries));
}

export function createLogger(scope: string) {
  return {
    debug: (...args: unknown[]) => push('debug', scope, args),
    info: (...args: unknown[]) => push('info', scope, args),
    warn: (...args: unknown[]) => push('warn', scope, args),
    error: (...args: unknown[]) => push('error', scope, args),
  };
}

export function getLogEntries(): LogEntry[] {
  return entries;
}

export function subscribeToLogs(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearLogs(): void {
  entries = [];
  listeners.forEach((l) => l(entries));
}
