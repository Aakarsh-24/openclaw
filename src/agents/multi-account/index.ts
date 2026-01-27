/**
 * Multi-Account Module
 * 
 * Provides multi-account load balancing for Clawdbot providers.
 */

export { AccountManager } from "./account-manager.js";
export type { Account, AccountManagerConfig, AuthProfileStore } from "./account-manager.js";

export { RateLimitTracker } from "./rate-limit-tracker.js";
export type { RateLimitState, BackoffResult } from "./rate-limit-tracker.js";

export { HealthScorer } from "./health-scorer.js";

export { QuotaTracker } from "./quota-tracker.js";
export type { ModelQuota, AccountQuota } from "./quota-tracker.js";

export {
  HybridStrategy,
  StickyStrategy,
  RoundRobinStrategy,
  createStrategy,
  STRATEGY_NAMES,
} from "./strategies.js";
export type { Strategy, SelectionResult, StrategyName } from "./strategies.js";

export * from "./constants.js";

// Integration helpers
export {
  isMultiAccountEnabled,
  getOrCreateManager,
  getManager,
  selectAccountForModel,
  notifyMultiAccountSuccess,
  notifyMultiAccountRateLimit,
  notifyMultiAccountFailure,
  notifyMultiAccountInvalid,
  getMultiAccountStatus,
  clearAllManagers,
  resetManagerState,
  type MultiAccountConfig,
  type MultiAccountSelection,
} from "./model-auth-integration.js";

// Profile order integration
export {
  resolveProfileOrderWithMultiAccount,
  resolveProfileOrderWithMultiAccountSync,
} from "./profile-order.js";
