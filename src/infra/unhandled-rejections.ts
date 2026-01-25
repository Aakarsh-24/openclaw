import process from "node:process";

import { formatUncaughtError } from "./errors.js";

type UnhandledRejectionHandler = (reason: unknown) => boolean;

const handlers = new Set<UnhandledRejectionHandler>();

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

/**
 * Check if an error is a transient network error that shouldn't crash the gateway.
 * These errors commonly occur during normal operation due to network instability,
 * timeouts, or external service issues.
 */
function isTransientNetworkError(reason: unknown): boolean {
  if (!(reason instanceof Error)) return false;

  const message = reason.message.toLowerCase();
  const name = reason.name;

  // Abort errors from cancelled requests
  if (name === "AbortError") return true;

  // Fetch/network failures
  if (message.includes("fetch failed")) return true;
  if (message.includes("network request failed")) return true;

  // Connection errors
  if (message.includes("econnreset")) return true;
  if (message.includes("econnrefused")) return true;
  if (message.includes("etimedout")) return true;
  if (message.includes("socket hang up")) return true;

  // TLS/SSL errors
  if (message.includes("unable to verify")) return true;
  if (message.includes("cert")) return true;

  return false;
}

export function installUnhandledRejectionHandler(): void {
  process.on("unhandledRejection", (reason, _promise) => {
    if (isUnhandledRejectionHandled(reason)) return;

    const errorMessage = formatUncaughtError(reason);

    // For transient network errors, log but don't crash
    if (isTransientNetworkError(reason)) {
      console.error("[clawdbot] Transient network error (non-fatal):", errorMessage);
      return;
    }

    // For other unhandled rejections, crash to surface the bug
    console.error("[clawdbot] Unhandled promise rejection:", errorMessage);
    process.exit(1);
  });
}
