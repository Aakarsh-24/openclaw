import process from "node:process";

import { extractErrorCode, formatUncaughtError } from "./errors.js";

type UnhandledRejectionHandler = (reason: unknown) => boolean;

const handlers = new Set<UnhandledRejectionHandler>();

const FATAL_ERROR_CODES = new Set([
  "ERR_OUT_OF_MEMORY",
  "ERR_SCRIPT_EXECUTION_TIMEOUT",
  "ERR_WORKER_OUT_OF_MEMORY",
  "ERR_WORKER_UNCAUGHT_EXCEPTION",
  "ERR_WORKER_INITIALIZATION_FAILED",
]);

const CONFIG_ERROR_CODES = new Set([
  "INVALID_CONFIG",
  "MISSING_API_KEY",
  "MISSING_CREDENTIALS",
]);

function isFatalError(err: unknown): boolean {
  const code = extractErrorCode(err);
  return code !== undefined && FATAL_ERROR_CODES.has(code);
}

function isConfigError(err: unknown): boolean {
  const code = extractErrorCode(err);
  return code !== undefined && CONFIG_ERROR_CODES.has(code);
}

export function registerUnhandledRejectionHandler(handler: UnhandledRejectionHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function isUnhandledRejectionHandled(reason: unknown): boolean {
  for (const handler of handlers) {
    try {
      if (handler(reason)) return true;
    } catch (err) {
      console.error(
        "[clawdbot] Unhandled rejection handler failed:",
        err instanceof Error ? (err.stack ?? err.message) : err,
      );
    }
  }
  return false;
}

export function installUnhandledRejectionHandler(): void {
  process.on("unhandledRejection", (reason, _promise) => {
    if (isUnhandledRejectionHandled(reason)) return;

    if (isFatalError(reason)) {
      console.error("[clawdbot] FATAL unhandled rejection:", formatUncaughtError(reason));
      process.exit(1);
      return;
    }

    if (isConfigError(reason)) {
      console.error(
        "[clawdbot] CONFIGURATION ERROR - requires fix:",
        formatUncaughtError(reason),
      );
      process.exit(1);
      return;
    }

    console.warn(
      "[clawdbot] Non-fatal unhandled rejection (continuing):",
      formatUncaughtError(reason),
    );
  });
}
