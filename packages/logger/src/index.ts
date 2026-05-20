export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  service: string;
  requestId?: string;
  userId?: string;
  projectId?: string;
  jobId?: string;
  [key: string]: unknown;
};

export function createLogger(defaultContext: LogContext) {
  const write = (level: LogLevel, message: string, context: Record<string, unknown> = {}) => {
    const payload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...defaultContext,
      ...context
    };
    const line = JSON.stringify(payload);
    if (level === "error") {
      console.error(line);
      return;
    }
    if (level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  };

  return {
    debug: (message: string, context?: Record<string, unknown>) => write("debug", message, context),
    info: (message: string, context?: Record<string, unknown>) => write("info", message, context),
    warn: (message: string, context?: Record<string, unknown>) => write("warn", message, context),
    error: (message: string, context?: Record<string, unknown>) => write("error", message, context)
  };
}
