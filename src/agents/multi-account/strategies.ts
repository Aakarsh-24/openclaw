/**
 * Account Selection Strategies
 */

import type { AccountManager } from "./account-manager.js";

export interface SelectionResult {
  account: { profileId: string; email: string } | null;
  waitMs: number;
}

export interface Strategy {
  init(manager: AccountManager): void;
  select(modelId: string): SelectionResult;
  notifySuccess(profileId: string, modelId: string): void;
  notifyRateLimit(profileId: string, modelId: string): void;
  getLabel(): string;
}

export class HybridStrategy implements Strategy {
  private manager!: AccountManager;
  private lastUsed = new Map<string, number>();

  init(manager: AccountManager): void {
    this.manager = manager;
  }

  select(modelId: string): SelectionResult {
    const { rateLimitTracker, healthScorer, quotaTracker } = this.manager;
    const profiles = this.manager.getProfilesForProvider();

    const available = profiles.filter(
      (id) => !rateLimitTracker.isRateLimited(id, modelId)
    );

    if (available.length === 0) {
      const minWait = rateLimitTracker.getMinWaitTime(profiles, modelId);
      return { account: null, waitMs: minWait };
    }

    const scored = available.map((profileId) => {
      const healthScore = healthScorer.getScore(profileId);
      const quotaRemaining = quotaTracker.getModelRemaining(profileId, modelId);
      const tierWeight = quotaTracker.getTierWeight(profileId);
      const lastUsedTime = this.lastUsed.get(profileId) ?? 0;
      const lruScore = Math.max(0, 100 - (Date.now() - lastUsedTime) / 60_000);
      const quotaPenalty = quotaTracker.isQuotaCritical(profileId, modelId) ? 30 : 0;

      const score =
        healthScore * 0.4 +
        (quotaRemaining ?? 0.5) * 100 * 0.3 +
        tierWeight * 20 * 0.2 +
        (100 - lruScore) * 0.1 -
        quotaPenalty;

      return { profileId, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const selected = scored[0];
    if (!selected) return { account: null, waitMs: 0 };

    this.lastUsed.set(selected.profileId, Date.now());
    return {
      account: this.manager.getAccountByProfileId(selected.profileId),
      waitMs: 0,
    };
  }

  notifySuccess(profileId: string): void {
    this.lastUsed.set(profileId, Date.now());
  }

  notifyRateLimit(): void {}

  getLabel(): string {
    return "Hybrid (health + quota + LRU)";
  }
}

export class StickyStrategy implements Strategy {
  private manager!: AccountManager;
  private sticky = new Map<string, string>();

  init(manager: AccountManager): void {
    this.manager = manager;
  }

  select(modelId: string): SelectionResult {
    const { rateLimitTracker } = this.manager;
    const profiles = this.manager.getProfilesForProvider();

    const current = this.sticky.get(modelId);
    if (current && !rateLimitTracker.isRateLimited(current, modelId)) {
      return {
        account: this.manager.getAccountByProfileId(current),
        waitMs: 0,
      };
    }

    const available = profiles.filter(
      (id) => !rateLimitTracker.isRateLimited(id, modelId)
    );

    if (available.length === 0) {
      const minWait = rateLimitTracker.getMinWaitTime(profiles, modelId);
      return { account: null, waitMs: minWait };
    }

    const selected = available[0];
    this.sticky.set(modelId, selected);
    return {
      account: this.manager.getAccountByProfileId(selected),
      waitMs: 0,
    };
  }

  notifySuccess(): void {}

  notifyRateLimit(profileId: string, modelId: string): void {
    if (this.sticky.get(modelId) === profileId) {
      this.sticky.delete(modelId);
    }
  }

  getLabel(): string {
    return "Sticky (cache-optimized)";
  }
}

export class RoundRobinStrategy implements Strategy {
  private manager!: AccountManager;
  private indices = new Map<string, number>();

  init(manager: AccountManager): void {
    this.manager = manager;
  }

  select(modelId: string): SelectionResult {
    const { rateLimitTracker } = this.manager;
    const profiles = this.manager.getProfilesForProvider();

    if (profiles.length === 0) return { account: null, waitMs: 0 };

    const startIndex = this.indices.get(modelId) ?? 0;
    let attempts = 0;

    while (attempts < profiles.length) {
      const index = (startIndex + attempts) % profiles.length;
      const profileId = profiles[index];

      if (!rateLimitTracker.isRateLimited(profileId, modelId)) {
        this.indices.set(modelId, (index + 1) % profiles.length);
        return {
          account: this.manager.getAccountByProfileId(profileId),
          waitMs: 0,
        };
      }
      attempts++;
    }

    const minWait = rateLimitTracker.getMinWaitTime(profiles, modelId);
    return { account: null, waitMs: minWait };
  }

  notifySuccess(): void {}
  notifyRateLimit(): void {}

  getLabel(): string {
    return "Round-Robin (even distribution)";
  }
}

export const STRATEGY_NAMES = ["hybrid", "sticky", "round-robin"] as const;
export type StrategyName = (typeof STRATEGY_NAMES)[number];

export function createStrategy(name?: string): Strategy {
  switch (name?.toLowerCase()) {
    case "sticky":
      return new StickyStrategy();
    case "round-robin":
    case "roundrobin":
      return new RoundRobinStrategy();
    case "hybrid":
    default:
      return new HybridStrategy();
  }
}
