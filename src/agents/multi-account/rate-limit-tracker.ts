/**
 * Rate Limit Tracker
 *
 * Tracks per-account, per-model rate limits with:
 * - Cooldown periods with expiry
 * - Exponential backoff state
 * - Deduplication to prevent thundering herd
 * - Consecutive failure tracking
 */

import {
  DEFAULT_COOLDOWN_MS,
  RATE_LIMIT_DEDUP_WINDOW_MS,
  RATE_LIMIT_STATE_RESET_MS,
  FIRST_RETRY_DELAY_MS,
  MAX_CONSECUTIVE_FAILURES,
  EXTENDED_COOLDOWN_MS,
  MIN_BACKOFF_MS,
} from "./constants.js";

export interface RateLimitState {
  cooldownUntil: number;
  consecutive429: number;
  lastAt: number;
  consecutiveFailures: number;
}

export interface BackoffResult {
  attempt: number;
  delayMs: number;
  isDuplicate: boolean;
}

export class RateLimitTracker {
  private stateMap = new Map<string, RateLimitState>();
  private failureCount = new Map<string, number>();

  private getKey(profileId: string, modelId: string): string {
    return `${profileId}:${modelId}`;
  }

  isRateLimited(profileId: string, modelId: string): boolean {
    const key = this.getKey(profileId, modelId);
    const state = this.stateMap.get(key);
    if (!state) return false;
    return Date.now() < state.cooldownUntil;
  }

  getCooldownRemaining(profileId: string, modelId: string): number {
    const key = this.getKey(profileId, modelId);
    const state = this.stateMap.get(key);
    if (!state) return 0;
    return Math.max(0, state.cooldownUntil - Date.now());
  }

  getSoonestReset(profileId: string): number | null {
    const now = Date.now();
    let soonest: number | null = null;

    for (const [key, state] of this.stateMap.entries()) {
      if (!key.startsWith(profileId + ":")) continue;
      if (state.cooldownUntil <= now) continue;
      if (soonest === null || state.cooldownUntil < soonest) {
        soonest = state.cooldownUntil;
      }
    }

    return soonest;
  }

  markRateLimited(
    profileId: string,
    modelId: string,
    cooldownMs: number = DEFAULT_COOLDOWN_MS
  ): BackoffResult {
    const key = this.getKey(profileId, modelId);
    const now = Date.now();
    const previous = this.stateMap.get(key);

    // Check deduplication window
    if (previous && now - previous.lastAt < RATE_LIMIT_DEDUP_WINDOW_MS) {
      const backoffDelay = Math.min(
        FIRST_RETRY_DELAY_MS * Math.pow(2, previous.consecutive429 - 1),
        60_000
      );
      return {
        attempt: previous.consecutive429,
        delayMs: Math.max(cooldownMs, backoffDelay),
        isDuplicate: true,
      };
    }

    // Determine attempt number
    const attempt =
      previous && now - previous.lastAt < RATE_LIMIT_STATE_RESET_MS
        ? previous.consecutive429 + 1
        : 1;

    // Calculate exponential backoff
    const backoffDelay = Math.min(
      FIRST_RETRY_DELAY_MS * Math.pow(2, attempt - 1),
      60_000
    );
    const effectiveCooldown = Math.max(cooldownMs, backoffDelay, MIN_BACKOFF_MS);

    // Update state
    this.stateMap.set(key, {
      cooldownUntil: now + effectiveCooldown,
      consecutive429: attempt,
      lastAt: now,
      consecutiveFailures: (previous?.consecutiveFailures ?? 0) + 1,
    });

    this.incrementFailures(profileId);

    return {
      attempt,
      delayMs: effectiveCooldown,
      isDuplicate: false,
    };
  }

  clearRateLimit(profileId: string, modelId: string): void {
    const key = this.getKey(profileId, modelId);
    this.stateMap.delete(key);
    this.failureCount.set(profileId, 0);
  }

  clearExpired(): void {
    const now = Date.now();
    for (const [key, state] of this.stateMap.entries()) {
      if (state.cooldownUntil <= now) {
        this.stateMap.delete(key);
      }
    }
  }

  getFailureCount(profileId: string): number {
    return this.failureCount.get(profileId) ?? 0;
  }

  incrementFailures(profileId: string): number {
    const current = this.failureCount.get(profileId) ?? 0;
    const newCount = current + 1;
    this.failureCount.set(profileId, newCount);
    return newCount;
  }

  shouldExtendCooldown(profileId: string): boolean {
    return this.getFailureCount(profileId) >= MAX_CONSECUTIVE_FAILURES;
  }

  applyExtendedCooldown(profileId: string): void {
    const now = Date.now();
    const cooldownUntil = now + EXTENDED_COOLDOWN_MS;

    for (const [key, state] of this.stateMap.entries()) {
      if (key.startsWith(profileId + ":")) {
        state.cooldownUntil = Math.max(state.cooldownUntil, cooldownUntil);
      }
    }

    const defaultKey = `${profileId}:*`;
    if (!this.stateMap.has(defaultKey)) {
      this.stateMap.set(defaultKey, {
        cooldownUntil,
        consecutive429: 0,
        lastAt: now,
        consecutiveFailures: this.getFailureCount(profileId),
      });
    }
  }

  getRateLimitedProfiles(modelId: string): string[] {
    const now = Date.now();
    const limited: string[] = [];

    for (const [key, state] of this.stateMap.entries()) {
      if (!key.endsWith(":" + modelId) && !key.endsWith(":*")) continue;
      if (state.cooldownUntil <= now) continue;
      const profileId = key.split(":").slice(0, -1).join(":");
      if (!limited.includes(profileId)) {
        limited.push(profileId);
      }
    }

    return limited;
  }

  areAllRateLimited(profileIds: string[], modelId: string): boolean {
    if (profileIds.length === 0) return false;
    return profileIds.every((id) => this.isRateLimited(id, modelId));
  }

  getMinWaitTime(profileIds: string[], modelId: string): number {
    let minWait = Infinity;

    for (const profileId of profileIds) {
      const remaining = this.getCooldownRemaining(profileId, modelId);
      if (remaining > 0 && remaining < minWait) {
        minWait = remaining;
      }
    }

    return minWait === Infinity ? 0 : minWait;
  }

  toJSON(): {
    rateState: Record<string, RateLimitState>;
    failureCounts: Record<string, number>;
  } {
    const state: Record<string, RateLimitState> = {};
    for (const [key, value] of this.stateMap.entries()) {
      state[key] = value;
    }
    return {
      rateState: state,
      failureCounts: Object.fromEntries(this.failureCount),
    };
  }

  fromJSON(data: {
    rateState?: Record<string, RateLimitState>;
    failureCounts?: Record<string, number>;
  }): void {
    if (data?.rateState) {
      for (const [key, value] of Object.entries(data.rateState)) {
        this.stateMap.set(key, value);
      }
    }
    if (data?.failureCounts) {
      for (const [key, value] of Object.entries(data.failureCounts)) {
        this.failureCount.set(key, value);
      }
    }
    this.clearExpired();
  }
}
