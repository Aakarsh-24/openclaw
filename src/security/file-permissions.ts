import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * SECURITY: File Permission Enforcement Module
 *
 * Ensures sensitive files and directories have appropriate permissions.
 * Enforces restrictive permissions on configuration, credentials, and state files.
 */

export interface PermissionCheck {
  path: string;
  exists: boolean;
  mode?: number;
  isDirectory?: boolean;
  isSymlink?: boolean;
  owner?: number;
  group?: number;
  worldReadable?: boolean;
  worldWritable?: boolean;
  groupWritable?: boolean;
}

export interface PermissionViolation {
  path: string;
  issue: string;
  severity: "warn" | "critical";
  remediation: string;
}

/**
 * Check permissions on a file or directory.
 */
export function checkPermissions(filePath: string): PermissionCheck {
  const result: PermissionCheck = {
    path: filePath,
    exists: false,
  };

  try {
    const stats = fs.lstatSync(filePath);
    result.exists = true;
    result.mode = stats.mode;
    result.isDirectory = stats.isDirectory();
    result.isSymlink = stats.isSymbolicLink();
    result.owner = stats.uid;
    result.group = stats.gid;

    // Check permission bits (Unix-style)
    const perms = stats.mode & 0o777;
    result.worldReadable = (perms & 0o004) !== 0;
    result.worldWritable = (perms & 0o002) !== 0;
    result.groupWritable = (perms & 0o020) !== 0;
  } catch {
    // File doesn't exist or can't be accessed
  }

  return result;
}

/**
 * Enforce restrictive permissions on a file (0600).
 */
export function enforceFilePermissions(
  filePath: string,
  mode: number = 0o600
): { changed: boolean; error?: string } {
  try {
    if (!fs.existsSync(filePath)) {
      return { changed: false };
    }

    const stats = fs.statSync(filePath);
    const currentMode = stats.mode & 0o777;

    if (currentMode !== mode) {
      fs.chmodSync(filePath, mode);
      return { changed: true };
    }

    return { changed: false };
  } catch (err) {
    return {
      changed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Enforce restrictive permissions on a directory (0700).
 */
export function enforceDirectoryPermissions(
  dirPath: string,
  mode: number = 0o700
): { changed: boolean; error?: string } {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode });
      return { changed: true };
    }

    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      return { changed: false, error: "Path is not a directory" };
    }

    const currentMode = stats.mode & 0o777;
    if (currentMode !== mode) {
      fs.chmodSync(dirPath, mode);
      return { changed: true };
    }

    return { changed: false };
  } catch (err) {
    return {
      changed: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Sensitive paths that should have restrictive permissions.
 */
export function getSensitivePaths(stateDir?: string): string[] {
  const homeDir = os.homedir();
  const resolvedStateDir = stateDir || path.join(homeDir, ".clawdbot");

  return [
    // State directory
    resolvedStateDir,
    // Config file
    path.join(resolvedStateDir, "clawdbot.json"),
    // Credentials directory
    path.join(resolvedStateDir, "credentials"),
    // OAuth file
    path.join(resolvedStateDir, "credentials", "oauth.json"),
    // Auth profiles
    path.join(resolvedStateDir, "auth-profiles.json"),
    // Exec approvals
    path.join(resolvedStateDir, "exec-approvals.json"),
    // Pairing files (wildcard - check directory)
    path.join(resolvedStateDir, "credentials"),
    // Audit logs
    path.join(resolvedStateDir, "audit"),
    // Session data
    path.join(resolvedStateDir, "sessions"),
  ];
}

/**
 * Validate permissions on all sensitive paths.
 */
export function validateSensitivePermissions(stateDir?: string): PermissionViolation[] {
  const violations: PermissionViolation[] = [];
  const paths = getSensitivePaths(stateDir);

  for (const filePath of paths) {
    const check = checkPermissions(filePath);

    if (!check.exists) continue;

    // Check for world-writable
    if (check.worldWritable) {
      violations.push({
        path: filePath,
        issue: "World-writable permissions",
        severity: "critical",
        remediation: check.isDirectory
          ? `chmod 700 "${filePath}"`
          : `chmod 600 "${filePath}"`,
      });
    }

    // Check for world-readable on sensitive files
    if (check.worldReadable && !check.isDirectory) {
      violations.push({
        path: filePath,
        issue: "World-readable permissions on sensitive file",
        severity: "warn",
        remediation: `chmod 600 "${filePath}"`,
      });
    }

    // Check for group-writable
    if (check.groupWritable) {
      violations.push({
        path: filePath,
        issue: "Group-writable permissions",
        severity: "warn",
        remediation: check.isDirectory
          ? `chmod 700 "${filePath}"`
          : `chmod 600 "${filePath}"`,
      });
    }

    // Check for symlinks (potential attack vector)
    if (check.isSymlink) {
      violations.push({
        path: filePath,
        issue: "Sensitive path is a symlink (potential security risk)",
        severity: "warn",
        remediation: "Verify symlink target is trusted",
      });
    }
  }

  return violations;
}

/**
 * Enforce restrictive permissions on all sensitive paths.
 * Returns the number of paths that were modified.
 */
export function enforceSensitivePermissions(stateDir?: string): {
  modified: number;
  errors: Array<{ path: string; error: string }>;
} {
  const paths = getSensitivePaths(stateDir);
  let modified = 0;
  const errors: Array<{ path: string; error: string }> = [];

  for (const filePath of paths) {
    if (!fs.existsSync(filePath)) continue;

    try {
      const stats = fs.statSync(filePath);
      const isDir = stats.isDirectory();
      const targetMode = isDir ? 0o700 : 0o600;

      const result = isDir
        ? enforceDirectoryPermissions(filePath, targetMode)
        : enforceFilePermissions(filePath, targetMode);

      if (result.changed) {
        modified += 1;
      }
      if (result.error) {
        errors.push({ path: filePath, error: result.error });
      }
    } catch (err) {
      errors.push({
        path: filePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { modified, errors };
}
