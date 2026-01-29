/**
 * SECURITY: Rate Limiting Module
 *
 * Provides rate limiting for various security-sensitive operations
 * to prevent abuse and brute-force attacks.
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional: block duration after limit exceeded (ms) */
  blockDurationMs?: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  blockedUntil?: number;
}

/**
 * In-memory rate limiter with configurable windows and blocking.
 */
export class RateLimiter {
  private entries = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed for the given key.
   * Returns true if allowed, false if rate limited.
   */
  check(key: string): boolean {
    const now = Date.now();
    const entry = this.entries.get(key);

    // Check if currently blocked
    if (entry?.blockedUntil && now < entry.blockedUntil) {
      return false;
    }

    // No entry or window expired - start fresh
    if (!entry || now - entry.windowStart > this.config.windowMs) {
      this.entries.set(key, {
        count: 1,
        windowStart: now,
        blockedUntil: undefined,
      });
      return true;
    }

    // Within window - check count
    if (entry.count >= this.config.maxRequests) {
      // Apply block if configured
      if (this.config.blockDurationMs) {
        entry.blockedUntil = now + this.config.blockDurationMs;
      }
      return false;
    }

    // Increment and allow
    entry.count += 1;
    return true;
  }

  /**
   * Get remaining requests for a key in the current window.
   */
  remaining(key: string): number {
    const now = Date.now();
    const entry = this.entries.get(key);

    if (!entry || now - entry.windowStart > this.config.windowMs) {
      return this.config.maxRequests;
    }

    if (entry.blockedUntil && now < entry.blockedUntil) {
      return 0;
    }

    return Math.max(0, this.config.maxRequests - entry.count);
  }

  /**
   * Reset rate limit for a key.
   */
  reset(key: string): void {
    this.entries.delete(key);
  }

  /**
   * Clean up expired entries to prevent memory leaks.
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.entries) {
      const windowExpired = now - entry.windowStart > this.config.windowMs;
      const blockExpired = !entry.blockedUntil || now >= entry.blockedUntil;

      if (windowExpired && blockExpired) {
        this.entries.delete(key);
        cleaned += 1;
      }
    }

    return cleaned;
  }
}

/**
 * Pre-configured rate limiters for common use cases.
 */

// Session message rate limiting (prevent spam)
export const sessionMessageLimiter = new RateLimiter({
  maxRequests: 60, // 60 messages
  windowMs: 60 * 1000, // per minute
  blockDurationMs: 30 * 1000, // 30 second block after limit
});

// Tool invocation rate limiting
export const toolInvocationLimiter = new RateLimiter({
  maxRequests: 100, // 100 tool calls
  windowMs: 60 * 1000, // per minute
});

// Exec command rate limiting
export const execCommandLimiter = new RateLimiter({
  maxRequests: 30, // 30 commands
  windowMs: 60 * 1000, // per minute
  blockDurationMs: 60 * 1000, // 1 minute block
});

// Gateway API rate limiting (for external callers)
export const gatewayApiLimiter = new RateLimiter({
  maxRequests: 120, // 120 requests
  windowMs: 60 * 1000, // per minute
});

// Auth attempt rate limiting
export const authAttemptLimiter = new RateLimiter({
  maxRequests: 5, // 5 attempts
  windowMs: 60 * 1000, // per minute
  blockDurationMs: 5 * 60 * 1000, // 5 minute block
});

/**
 * Periodic cleanup for all rate limiters.
 * Should be called periodically (e.g., every 5 minutes).
 */
export function cleanupAllRateLimiters(): number {
  let total = 0;
  total += sessionMessageLimiter.cleanup();
  total += toolInvocationLimiter.cleanup();
  total += execCommandLimiter.cleanup();
  total += gatewayApiLimiter.cleanup();
  total += authAttemptLimiter.cleanup();
  return total;
}

// Start automatic cleanup every 5 minutes
let cleanupInterval: NodeJS.Timeout | null = null;

export function startRateLimitCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    cleanupAllRateLimiters();
  }, 5 * 60 * 1000);
  // Don't prevent process exit
  cleanupInterval.unref();
}

export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
