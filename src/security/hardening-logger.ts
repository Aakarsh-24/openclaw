import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "../config/paths.js";

export type SecurityEventType =
  | "blocked_sender"
  | "blocked_network"
  | "allowed_network"
  | "sensitive_file_access"
  | "hardening_init"
  | "hardening_error";

export type SecurityEvent = {
  timestamp: string;
  type: SecurityEventType;
  detail: Record<string, unknown>;
};

export type HardeningLoggerOptions = {
  /** Override the log file path. Defaults to ~/.clawdbot/security-audit.log */
  logFile?: string;
  /** Also emit events to this callback (for tests). */
  onEvent?: (event: SecurityEvent) => void;
  /** Max log file size in bytes before rotation. Default: 10 MB. */
  maxFileSizeBytes?: number;
  /** Number of rotated log files to keep. Default: 3. */
  maxRotatedFiles?: number;
};

/** Default max log file size: 10 MB */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Default number of rotated files to keep */
const DEFAULT_MAX_ROTATED = 3;

let logStream: fs.WriteStream | null = null;
let logFilePath: string | null = null;
let eventCallback: ((event: SecurityEvent) => void) | null = null;
let bytesWritten = 0;
let maxFileSize = DEFAULT_MAX_FILE_SIZE;
let maxRotated = DEFAULT_MAX_ROTATED;

/**
 * Resolve the default security log path.
 */
function defaultLogPath(): string {
  const stateDir = resolveStateDir();
  return path.join(stateDir, "security-audit.log");
}

/**
 * Rotate the log file when it exceeds the size limit.
 * Renames: .log -> .log.1, .log.1 -> .log.2, etc. Deletes oldest.
 */
function rotateLogFile(): void {
  if (!logFilePath || !logStream) return;
  try {
    logStream.end();
    logStream = null;

    // Shift existing rotated files
    for (let i = maxRotated; i >= 1; i--) {
      const older = `${logFilePath}.${i}`;
      if (i === maxRotated) {
        try {
          fs.unlinkSync(older);
        } catch {
          // ignore
        }
      }
      const newer = i === 1 ? logFilePath : `${logFilePath}.${i - 1}`;
      try {
        fs.renameSync(newer, older);
      } catch {
        // ignore (file may not exist)
      }
    }

    // Open a fresh log file
    logStream = fs.createWriteStream(logFilePath, { flags: "a", mode: 0o600 });
    logStream.on("error", () => {});
    bytesWritten = 0;
  } catch {
    // If rotation fails, continue with current stream
  }
}

/**
 * Initialize the hardening audit logger.
 * Call once at gateway startup, before any other security module.
 */
export function initHardeningLogger(opts?: HardeningLoggerOptions): void {
  if (logStream) return; // already initialized
  logFilePath = opts?.logFile ?? defaultLogPath();
  eventCallback = opts?.onEvent ?? null;
  maxFileSize = opts?.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE;
  maxRotated = opts?.maxRotatedFiles ?? DEFAULT_MAX_ROTATED;
  try {
    const dir = path.dirname(logFilePath);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    logStream = fs.createWriteStream(logFilePath, { flags: "a", mode: 0o600 });
    // Silently handle write stream errors to avoid crashing the gateway.
    logStream.on("error", () => {});
    // Track current file size for rotation
    try {
      bytesWritten = fs.statSync(logFilePath).size;
    } catch {
      bytesWritten = 0;
    }
  } catch {
    // If we can't open the log file, continue without file logging.
    // The onEvent callback (if set) will still work.
    logStream = null;
  }
}

/**
 * Write a structured security event to the audit log.
 */
export function logSecurityEvent(type: SecurityEventType, detail: Record<string, unknown>): void {
  const event: SecurityEvent = {
    timestamp: new Date().toISOString(),
    type,
    detail,
  };
  if (logStream) {
    const line = JSON.stringify(event) + "\n";
    logStream.write(line);
    bytesWritten += Buffer.byteLength(line, "utf-8");
    // Rotate if file exceeds max size
    if (bytesWritten >= maxFileSize) {
      rotateLogFile();
    }
  }
  if (eventCallback) {
    eventCallback(event);
  }
}

/**
 * Close the audit log stream. Call on gateway shutdown.
 */
export function closeHardeningLogger(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
  logFilePath = null;
  eventCallback = null;
  bytesWritten = 0;
}

/**
 * Get the current log file path (for status/diagnostics).
 */
export function getHardeningLogPath(): string | null {
  return logFilePath;
}

/** Reset internal state (test-only). */
export function __resetHardeningLoggerForTest(): void {
  closeHardeningLogger();
}
