/**
 * Quota Tracker
 *
 * Tracks quota information per account:
 * - Subscription tier (free/pro/ultra)
 * - Per-model remaining quota
 * - Reset times
 */

import { TIER_WEIGHTS } from "./constants.js";

export interface ModelQuota {
  remainingFraction: number | null;
  resetTime: number | null;
}

export interface AccountQuota {
  tier: "free" | "pro" | "ultra" | "unknown";
  projectId: string | null;
  models: Record<string, ModelQuota>;
  lastChecked: number;
}

export class QuotaTracker {
  private quotas = new Map<string, AccountQuota>();
  private cacheTtlMs = 5 * 60 * 1000;

  setCacheTtl(ms: number): void {
    this.cacheTtlMs = ms;
  }

  getQuota(profileId: string): AccountQuota | null {
    const quota = this.quotas.get(profileId);
    if (!quota) return null;

    if (Date.now() - quota.lastChecked > this.cacheTtlMs) {
      return null;
    }

    return quota;
  }

  updateQuota(profileId: string, data: Partial<AccountQuota>): void {
    const existing = this.quotas.get(profileId) ?? {
      tier: "unknown" as const,
      projectId: null,
      models: {},
      lastChecked: 0,
    };

    this.quotas.set(profileId, {
      ...existing,
      ...data,
      lastChecked: Date.now(),
    });
  }

  updateModelQuota(
    profileId: string,
    modelId: string,
    quota: ModelQuota
  ): void {
    const existing = this.getQuota(profileId) ?? {
      tier: "unknown" as const,
      projectId: null,
      models: {},
      lastChecked: 0,
    };

    existing.models[modelId] = quota;
    existing.lastChecked = Date.now();
    this.quotas.set(profileId, existing);
  }

  getTierWeight(profileId: string): number {
    const quota = this.quotas.get(profileId);
    const tier = quota?.tier ?? "unknown";
    return TIER_WEIGHTS[tier] ?? TIER_WEIGHTS.unknown;
  }

  getModelRemaining(profileId: string, modelId: string): number | null {
    const quota = this.getQuota(profileId);
    if (!quota) return null;
    return quota.models[modelId]?.remainingFraction ?? null;
  }

  isQuotaExhausted(profileId: string, modelId: string): boolean {
    const remaining = this.getModelRemaining(profileId, modelId);
    return remaining === 0;
  }

  isQuotaCritical(profileId: string, modelId: string): boolean {
    const remaining = this.getModelRemaining(profileId, modelId);
    if (remaining === null) return false;
    return remaining < 0.05;
  }

  getSortedByQuota(profileIds: string[], modelId: string): string[] {
    return [...profileIds].sort((a, b) => {
      const quotaA = this.getModelRemaining(a, modelId) ?? 0.5;
      const quotaB = this.getModelRemaining(b, modelId) ?? 0.5;

      if (quotaA === 0 && quotaB !== 0) return 1;
      if (quotaB === 0 && quotaA !== 0) return -1;

      return quotaB - quotaA;
    });
  }

  getSortedByTier(profileIds: string[]): string[] {
    return [...profileIds].sort((a, b) => {
      return this.getTierWeight(b) - this.getTierWeight(a);
    });
  }

  markExhausted(profileId: string, modelId: string, resetTime: number): void {
    this.updateModelQuota(profileId, modelId, {
      remainingFraction: 0,
      resetTime,
    });
  }

  toJSON(): { quotas: Record<string, AccountQuota> } {
    return {
      quotas: Object.fromEntries(this.quotas),
    };
  }

  fromJSON(data: { quotas?: Record<string, AccountQuota> }): void {
    if (data?.quotas) {
      for (const [key, value] of Object.entries(data.quotas)) {
        this.quotas.set(key, value);
      }
    }
  }
}
