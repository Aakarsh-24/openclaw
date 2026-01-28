import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { logSecurityEvent } from "./hardening-logger.js";

/**
 * Default sensitive path patterns to monitor.
 * Paths are resolved relative to the user's home directory.
 */
const DEFAULT_SENSITIVE_PATHS: string[] = [
  "~/.ssh",
  "~/.aws",
  "~/.gnupg",
  "~/.config/gcloud",
  "~/.azure",
  "~/.kube",
  "~/.docker",
  "~/.npmrc",
  "~/.netrc",
  "~/.clawdbot/credentials",
  "~/.moltbot/credentials",
  "~/.gitconfig",
  "~/.bash_history",
  "~/.zsh_history",
  "/etc/shadow",
  "/etc/passwd",
];

export type FsMonitorOptions = {
  /** Extra sensitive paths to monitor. Supports ~ for home dir. */
  extraSensitivePaths?: string[];
  /** Replace the default sensitive paths entirely. */
  sensitivePaths?: string[];
  /** If true, block access to sensitive paths. If false, only log. Default: false (audit mode). */
  enforce?: boolean;
};

let resolvedSensitivePaths: string[] | null = null;
let enforceMode = false;
let installed = false;

// Original function references for restoration
let origReadFileSync: typeof fs.readFileSync | null = null;
let origWriteFileSync: typeof fs.writeFileSync | null = null;
let origReadFile: typeof fs.promises.readFile | null = null;
let origWriteFile: typeof fs.promises.writeFile | null = null;
let origStat: typeof fs.promises.stat | null = null;
let origUnlink: typeof fs.promises.unlink | null = null;

/**
 * Resolve a path that may start with ~.
 */
function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

/**
 * Resolve a file path, following symlinks where possible to prevent bypass via symlinks.
 */
function resolveRealPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    // If realpath fails (e.g. file doesn't exist yet), fall back to path.resolve
    return resolved;
  }
}

/**
 * Check if a path falls under any sensitive path prefix.
 */
export function isSensitivePath(filePath: string): boolean {
  if (!resolvedSensitivePaths) return false;
  const normalized = resolveRealPath(filePath);
  for (const sensitive of resolvedSensitivePaths) {
    if (normalized === sensitive || normalized.startsWith(sensitive + path.sep)) {
      return true;
    }
  }
  return false;
}

/**
 * Record an access to a sensitive file in the audit log.
 * Returns true if access is allowed, false if blocked (enforce mode).
 */
export function auditFileAccess(
  filePath: string,
  operation: "read" | "write" | "stat" | "readdir" | "unlink",
): boolean {
  if (!resolvedSensitivePaths) return true;
  const normalized = resolveRealPath(filePath);
  if (!isSensitivePath(normalized)) return true;

  logSecurityEvent("sensitive_file_access", {
    operation,
    path: normalized,
    allowed: !enforceMode,
    stackTrace: new Error().stack?.split("\n").slice(2, 7).join("\n"),
  });

  return !enforceMode;
}

/**
 * Create a guard wrapper that audits the first arg (file path) before calling the original.
 */
function createGuard(
  operation: "read" | "write" | "stat" | "readdir" | "unlink",
): (filePath: unknown) => void {
  return (filePath: unknown) => {
    if (typeof filePath === "string") {
      const allowed = auditFileAccess(filePath, operation);
      if (!allowed) {
        throw new Error(`[fs-monitor] Blocked ${operation} access to sensitive path: ${filePath}`);
      }
    }
  };
}

/**
 * Install fs monitoring hooks for sensitive path auditing.
 * Hooks both sync and async versions of: readFile, writeFile, stat, unlink.
 */
export function installFsMonitor(opts?: FsMonitorOptions): void {
  if (installed) return;

  const rawPaths = opts?.sensitivePaths ?? [
    ...DEFAULT_SENSITIVE_PATHS,
    ...(opts?.extraSensitivePaths ?? []),
  ];
  resolvedSensitivePaths = rawPaths.map((p) => path.resolve(expandHome(p)));
  enforceMode = opts?.enforce ?? false;

  const readGuard = createGuard("read");
  const writeGuard = createGuard("write");
  const statGuard = createGuard("stat");
  const unlinkGuard = createGuard("unlink");

  // Sync hooks
  origReadFileSync = fs.readFileSync;
  const origRFS = origReadFileSync;
  (fs as { readFileSync: typeof fs.readFileSync }).readFileSync = ((...args: unknown[]) => {
    readGuard(args[0]);
    return (origRFS as Function).apply(fs, args);
  }) as typeof fs.readFileSync;

  origWriteFileSync = fs.writeFileSync;
  const origWFS = origWriteFileSync;
  (fs as { writeFileSync: typeof fs.writeFileSync }).writeFileSync = ((...args: unknown[]) => {
    writeGuard(args[0]);
    return (origWFS as Function).apply(fs, args);
  }) as typeof fs.writeFileSync;

  // Async hooks (fs.promises)
  origReadFile = fs.promises.readFile;
  const origRF = origReadFile;
  (fs.promises as { readFile: typeof fs.promises.readFile }).readFile = (async (
    ...args: unknown[]
  ) => {
    readGuard(args[0]);
    return (origRF as Function).apply(fs.promises, args);
  }) as typeof fs.promises.readFile;

  origWriteFile = fs.promises.writeFile;
  const origWF = origWriteFile;
  (fs.promises as { writeFile: typeof fs.promises.writeFile }).writeFile = (async (
    ...args: unknown[]
  ) => {
    writeGuard(args[0]);
    return (origWF as Function).apply(fs.promises, args);
  }) as typeof fs.promises.writeFile;

  origStat = fs.promises.stat;
  const origST = origStat;
  (fs.promises as { stat: typeof fs.promises.stat }).stat = (async (...args: unknown[]) => {
    statGuard(args[0]);
    return (origST as Function).apply(fs.promises, args);
  }) as typeof fs.promises.stat;

  origUnlink = fs.promises.unlink;
  const origUL = origUnlink;
  (fs.promises as { unlink: typeof fs.promises.unlink }).unlink = (async (...args: unknown[]) => {
    unlinkGuard(args[0]);
    return (origUL as Function).apply(fs.promises, args);
  }) as typeof fs.promises.unlink;

  installed = true;

  logSecurityEvent("hardening_init", {
    module: "fs-monitor",
    sensitivePathCount: resolvedSensitivePaths.length,
    enforce: enforceMode,
    hookedMethods: [
      "readFileSync",
      "writeFileSync",
      "promises.readFile",
      "promises.writeFile",
      "promises.stat",
      "promises.unlink",
    ],
  });
}

/**
 * Uninstall the fs monitor, restoring original functions.
 */
export function uninstallFsMonitor(): void {
  if (!installed) return;
  if (origReadFileSync) {
    (fs as { readFileSync: typeof fs.readFileSync }).readFileSync = origReadFileSync;
    origReadFileSync = null;
  }
  if (origWriteFileSync) {
    (fs as { writeFileSync: typeof fs.writeFileSync }).writeFileSync = origWriteFileSync;
    origWriteFileSync = null;
  }
  if (origReadFile) {
    (fs.promises as { readFile: typeof fs.promises.readFile }).readFile = origReadFile;
    origReadFile = null;
  }
  if (origWriteFile) {
    (fs.promises as { writeFile: typeof fs.promises.writeFile }).writeFile = origWriteFile;
    origWriteFile = null;
  }
  if (origStat) {
    (fs.promises as { stat: typeof fs.promises.stat }).stat = origStat;
    origStat = null;
  }
  if (origUnlink) {
    (fs.promises as { unlink: typeof fs.promises.unlink }).unlink = origUnlink;
    origUnlink = null;
  }
  resolvedSensitivePaths = null;
  installed = false;
}

/**
 * Check if the fs monitor is currently active.
 */
export function isFsMonitorActive(): boolean {
  return installed;
}

/** Reset internal state (test-only). */
export function __resetFsMonitorForTest(): void {
  uninstallFsMonitor();
}
