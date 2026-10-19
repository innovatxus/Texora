type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minimumLevel(): Level {
  const configured = process.env.LOG_LEVEL;
  if (
    configured === "debug" ||
    configured === "info" ||
    configured === "warn" ||
    configured === "error"
  ) {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function serialise(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function write(level: Level, event: string, fields: Record<string, unknown> = {}) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minimumLevel()]) return;
  const record = JSON.stringify({
    level,
    event,
    time: new Date().toISOString(),
    ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, serialise(v)])),
  });
  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(`${record}\n`);
}

/** Structured JSON logs: one event name plus fields. Never log secrets or card data. */
export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) => write("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};
