/**
 * Constants for multi-account management
 * Aligned with antigravity-claude-proxy defaults
 */

// Default cooldown when rate-limited (10 seconds)
export const DEFAULT_COOLDOWN_MS = 10_000;

// Max time to wait before throwing error (2 minutes)
export const MAX_WAIT_BEFORE_ERROR_MS = 120_000;

// Deduplication window for rate limits (prevents thundering herd)
export const RATE_LIMIT_DEDUP_WINDOW_MS = 2_000;

// Reset rate limit state after this inactivity period
export const RATE_LIMIT_STATE_RESET_MS = 60_000;

// First retry delay on 429 (quick retry)
export const FIRST_RETRY_DELAY_MS = 1_000;

// Delay before switching accounts
export const SWITCH_ACCOUNT_DELAY_MS = 500;

// Consecutive failures before extended cooldown
export const MAX_CONSECUTIVE_FAILURES = 3;

// Extended cooldown for consistently failing accounts (5 minutes)
export const EXTENDED_COOLDOWN_MS = 300_000;

// Exponential backoff tiers for capacity exhaustion
export const BACKOFF_TIERS_MS = [1_000, 2_000, 5_000, 10_000];

// Quota exhausted backoff tiers (progressive: 1min, 5min, 30min, 2h)
export const QUOTA_EXHAUSTED_BACKOFF_TIERS_MS = [60_000, 300_000, 1_800_000, 7_200_000];

// Minimum backoff to prevent loops
export const MIN_BACKOFF_MS = 500;

// Backoff by error type
export const BACKOFF_BY_ERROR_TYPE = {
  RATE_LIMIT_EXCEEDED: 5_000,
  QUOTA_EXHAUSTED: 60_000,
  MODEL_CAPACITY_EXHAUSTED: 10_000,
  SERVER_ERROR: 2_000,
  UNKNOWN: 5_000,
};

// Health score defaults
export const HEALTH_SCORE = {
  initial: 100,
  maxScore: 100,
  minScore: 0,
  successBonus: 5,
  failurePenalty: 15,
  rateLimitPenalty: 10,
  recoveryPerMinute: 2,
};

// Subscription tier weights (higher = more capacity expected)
export const TIER_WEIGHTS: Record<string, number> = {
  ultra: 3,
  pro: 2,
  free: 1,
  unknown: 1,
};
