/**
 * XMTP Channel Logger
 *
 * Structured logging with subsystem tagging for the XMTP channel.
 * Follows the pattern used by Discord and Telegram channels.
 */

import { getXmtpRuntime } from "./runtime.js";

/**
 * Log levels supported by the logger.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Logger interface for XMTP channel operations.
 */
export interface XmtpLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): XmtpLogger;
}

/**
 * Format a log message with subsystem prefix.
 */
function formatMessage(
  subsystem: string,
  accountId: string | undefined,
  message: string
): string {
  const prefix = accountId ? `[${subsystem}:${accountId}]` : `[${subsystem}]`;
  return `${prefix} ${message}`;
}

/**
 * Create a logger instance for the XMTP channel.
 * Uses the clawdbot runtime logger when available, falls back to console.
 */
export function createLogger(options?: {
  subsystem?: string;
  accountId?: string;
}): XmtpLogger {
  const subsystem = options?.subsystem ?? "xmtp";
  const accountId = options?.accountId;

  // Try to get runtime logger, fall back to console
  let runtimeLogger: Record<string, (...args: unknown[]) => void> | null = null;
  try {
    const runtime = getXmtpRuntime();
    // Runtime may have a log property not typed in the interface
    const runtimeAny = runtime as unknown as Record<string, unknown>;
    if (runtimeAny?.log) {
      runtimeLogger = runtimeAny.log as Record<string, (...args: unknown[]) => void>;
    }
  } catch {
    // Runtime not initialized, use console fallback
  }

  const log = (
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void => {
    const formattedMessage = formatMessage(subsystem, accountId, message);

    if (runtimeLogger && typeof runtimeLogger[level] === "function") {
      if (context) {
        runtimeLogger[level](formattedMessage, context);
      } else {
        runtimeLogger[level](formattedMessage);
      }
    } else {
      // Fallback to console
      const logFn = console[level] || console.log;
      if (context) {
        logFn(formattedMessage, context);
      } else {
        logFn(formattedMessage);
      }
    }
  };

  return {
    debug: (message, context) => log("debug", message, context),
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, context) => log("error", message, context),
    child: (childContext) =>
      createLogger({
        subsystem: (childContext.subsystem as string) ?? subsystem,
        accountId: (childContext.accountId as string) ?? accountId,
      }),
  };
}

/**
 * Default logger instance for XMTP channel.
 */
let defaultLogger: XmtpLogger | null = null;

/**
 * Get the default XMTP logger.
 * Creates one if it doesn't exist.
 */
export function getLogger(): XmtpLogger {
  if (!defaultLogger) {
    defaultLogger = createLogger();
  }
  return defaultLogger;
}

/**
 * Create a logger for a specific XMTP account.
 */
export function getAccountLogger(accountId: string): XmtpLogger {
  return createLogger({ accountId });
}

/**
 * Reset the default logger (useful for testing).
 */
export function resetLogger(): void {
  defaultLogger = null;
}
