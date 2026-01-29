/**
 * SECURITY: Core security module exports
 *
 * This module provides centralized access to all security utilities.
 */

// Audit logging
export {
  type AuditEventType,
  type AuditLogEntry,
  configureAuditLog,
  logSessionStart,
  logSessionEnd,
  logAuthFailure,
  logToolInvoke,
  logToolDenied,
  logExecRun,
  logDangerousCommandBlocked,
  logPairingEvent,
  logConfigChange,
  logSecretDetected,
  cleanupOldLogs,
} from "./audit-log.js";

// Dangerous command detection
export {
  type DangerousCommandMatch,
  detectDangerousCommand,
  formatDangerousCommandError,
} from "./dangerous-commands.js";

// External content handling
export {
  type ExternalContentSource,
  type WrapExternalContentOptions,
  type WebContentSource,
  type WrapWebContentOptions,
  detectSuspiciousPatterns,
  wrapExternalContent,
  buildSafeExternalPrompt,
  isExternalHookSession,
  getHookType,
  wrapWebContent,
  tagSearchSnippet,
} from "./external-content.js";

// File permissions
export {
  type PermissionCheck,
  type PermissionViolation,
  checkPermissions,
  enforceFilePermissions,
  enforceDirectoryPermissions,
  getSensitivePaths,
  validateSensitivePermissions,
  enforceSensitivePermissions,
} from "./file-permissions.js";

// Rate limiting
export {
  type RateLimitConfig,
  RateLimiter,
  sessionMessageLimiter,
  toolInvocationLimiter,
  execCommandLimiter,
  gatewayApiLimiter,
  authAttemptLimiter,
  cleanupAllRateLimiters,
  startRateLimitCleanup,
  stopRateLimitCleanup,
} from "./rate-limit.js";

// Secret guard
export {
  ensureFilePermissions600,
  assertNoSecretsInFile,
  assertNoSecretsInConfig,
} from "./secret-guard.js";
