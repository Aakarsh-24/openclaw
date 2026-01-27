/**
 * XMTP Channel Error Classes
 *
 * Custom error classes for the XMTP channel with:
 * - Error categorization (network, auth, protocol, config, validation)
 * - User-friendly messages
 * - JSON serialization for logging
 * - Retry detection utilities
 */

/**
 * Error categories for XMTP operations.
 */
export type XmtpErrorCategory =
  | "network"
  | "auth"
  | "protocol"
  | "config"
  | "validation"
  | "unknown";

/**
 * Error codes for specific error conditions.
 */
export type XmtpErrorCode =
  // Network errors
  | "NETWORK_TIMEOUT"
  | "NETWORK_DISCONNECTED"
  | "NETWORK_UNREACHABLE"
  // Auth errors
  | "AUTH_INVALID_KEY"
  | "AUTH_EXPIRED"
  | "AUTH_UNAUTHORIZED"
  // Protocol errors
  | "PROTOCOL_SEND_FAILED"
  | "PROTOCOL_CONVERSATION_NOT_FOUND"
  | "PROTOCOL_MESSAGE_TOO_LARGE"
  | "PROTOCOL_INVALID_CONTENT_TYPE"
  // Config errors
  | "CONFIG_MISSING_WALLET_KEY"
  | "CONFIG_INVALID_ENV"
  | "CONFIG_INVALID_POLICY"
  // Validation errors
  | "VALIDATION_INVALID_ADDRESS"
  | "VALIDATION_INVALID_MESSAGE"
  | "VALIDATION_MISSING_REQUIRED"
  // Unknown
  | "UNKNOWN_ERROR";

/**
 * User-friendly error messages mapped by error code.
 */
const USER_MESSAGES: Partial<Record<XmtpErrorCode, string>> = {
  NETWORK_TIMEOUT: "Connection timed out. Please try again.",
  NETWORK_DISCONNECTED: "Connection lost. Reconnecting...",
  NETWORK_UNREACHABLE: "Network unreachable. Check your connection.",
  AUTH_INVALID_KEY: "Invalid wallet key configured. Check your XMTP settings.",
  AUTH_EXPIRED: "Session expired. Please reconnect.",
  AUTH_UNAUTHORIZED: "Not authorized to perform this action.",
  PROTOCOL_SEND_FAILED: "Failed to send message. Please try again.",
  PROTOCOL_CONVERSATION_NOT_FOUND: "Conversation not found.",
  PROTOCOL_MESSAGE_TOO_LARGE: "Message is too large to send.",
  CONFIG_MISSING_WALLET_KEY: "Wallet key not configured. Set XMTP_WALLET_KEY.",
  CONFIG_INVALID_ENV: "Invalid XMTP environment. Use 'dev' or 'production'.",
  VALIDATION_INVALID_ADDRESS: "Invalid Ethereum address format.",
  VALIDATION_INVALID_MESSAGE: "Invalid message format.",
  UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
};

/**
 * Options for creating an XmtpError.
 */
export interface XmtpErrorOptions {
  message: string;
  category: XmtpErrorCategory;
  code: XmtpErrorCode;
  retryable?: boolean;
  context?: Record<string, unknown>;
  cause?: Error;
}

/**
 * Base error class for XMTP channel errors.
 */
export class XmtpError extends Error {
  readonly category: XmtpErrorCategory;
  readonly code: XmtpErrorCode;
  readonly retryable: boolean;
  readonly context?: Record<string, unknown>;

  constructor(options: XmtpErrorOptions) {
    super(options.message);
    this.name = "XmtpError";
    this.category = options.category;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.context = options.context;

    if (options.cause) {
      this.cause = options.cause;
    }

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get a user-friendly error message suitable for display.
   */
  toUserMessage(): string {
    return USER_MESSAGES[this.code] ?? this.message;
  }

  /**
   * Convert error to JSON for logging.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      code: this.code,
      retryable: this.retryable,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Options for creating an XmtpSendError.
 */
export interface XmtpSendErrorOptions {
  message: string;
  code: XmtpErrorCode;
  recipient?: string;
  conversationId?: string;
  retryable?: boolean;
  context?: Record<string, unknown>;
  cause?: Error;
}

/**
 * Error class for message sending failures.
 */
export class XmtpSendError extends XmtpError {
  readonly recipient?: string;
  readonly conversationId?: string;

  constructor(options: XmtpSendErrorOptions) {
    super({
      message: options.message,
      category: "protocol",
      code: options.code,
      retryable: options.retryable,
      context: options.context,
      cause: options.cause,
    });
    this.name = "XmtpSendError";
    this.recipient = options.recipient;
    this.conversationId = options.conversationId;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      name: this.name,
      recipient: this.recipient,
      conversationId: this.conversationId,
    };
  }
}

/**
 * Options for creating an XmtpConfigError.
 */
export interface XmtpConfigErrorOptions {
  message: string;
  code: XmtpErrorCode;
  configKey?: string;
  context?: Record<string, unknown>;
  cause?: Error;
}

/**
 * Error class for configuration issues.
 */
export class XmtpConfigError extends XmtpError {
  readonly configKey?: string;

  constructor(options: XmtpConfigErrorOptions) {
    super({
      message: options.message,
      category: "config",
      code: options.code,
      retryable: false, // Config errors are never retryable
      context: options.context,
      cause: options.cause,
    });
    this.name = "XmtpConfigError";
    this.configKey = options.configKey;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      name: this.name,
      configKey: this.configKey,
    };
  }
}

/**
 * Options for creating an XmtpValidationError.
 */
export interface XmtpValidationErrorOptions {
  message: string;
  code: XmtpErrorCode;
  field?: string;
  value?: unknown;
  context?: Record<string, unknown>;
  cause?: Error;
}

/**
 * Error class for validation failures.
 */
export class XmtpValidationError extends XmtpError {
  readonly field?: string;
  readonly value?: unknown;

  constructor(options: XmtpValidationErrorOptions) {
    super({
      message: options.message,
      category: "validation",
      code: options.code,
      retryable: false, // Validation errors are never retryable
      context: options.context,
      cause: options.cause,
    });
    this.name = "XmtpValidationError";
    this.field = options.field;
    this.value = options.value;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      name: this.name,
      field: this.field,
      value: this.value,
    };
  }
}

/**
 * Patterns that indicate a retryable error.
 */
const RETRYABLE_PATTERNS = [
  /etimedout/i,
  /econnreset/i,
  /econnrefused/i,
  /timeout/i,
  /temporarily unavailable/i,
  /rate limit/i,
  /too many requests/i,
  /503/,
  /502/,
  /504/,
];

/**
 * Check if an error is retryable.
 * For XmtpError instances, uses the retryable flag.
 * For other errors, infers from the error message.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof XmtpError) {
    return error.retryable;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return RETRYABLE_PATTERNS.some((pattern) => pattern.test(message));
  }

  return false;
}

/**
 * Wrap a generic error as an XmtpError.
 * If already an XmtpError, returns it unchanged.
 * Otherwise, attempts to classify the error based on its message.
 */
export function wrapError(
  error: unknown,
  context?: Record<string, unknown>
): XmtpError {
  // Already an XmtpError - return as-is
  if (error instanceof XmtpError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();
  const cause = error instanceof Error ? error : undefined;

  // Check for timeout errors
  if (/timeout|etimedout/i.test(message)) {
    return new XmtpError({
      message,
      category: "network",
      code: "NETWORK_TIMEOUT",
      retryable: true,
      context,
      cause,
    });
  }

  // Check for connection errors
  if (/econnreset|econnrefused|disconnected/i.test(message)) {
    return new XmtpError({
      message,
      category: "network",
      code: "NETWORK_DISCONNECTED",
      retryable: true,
      context,
      cause,
    });
  }

  // Check for conversation not found
  if (lowerMessage.includes("conversation not found")) {
    return new XmtpSendError({
      message,
      code: "PROTOCOL_CONVERSATION_NOT_FOUND",
      retryable: false,
      context,
      cause,
    });
  }

  // Check for auth errors
  if (/unauthorized|invalid key|auth/i.test(message)) {
    return new XmtpError({
      message,
      category: "auth",
      code: "AUTH_INVALID_KEY",
      retryable: false,
      context,
      cause,
    });
  }

  // Default to unknown error
  return new XmtpError({
    message,
    category: "unknown",
    code: "UNKNOWN_ERROR",
    retryable: false,
    context,
    cause,
  });
}
