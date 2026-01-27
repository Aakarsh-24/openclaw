/**
 * Account Manager
 *
 * Central manager for multi-account load balancing.
 */

import { RateLimitTracker } from "./rate-limit-tracker.js";
import { HealthScorer } from "./health-scorer.js";
import { QuotaTracker } from "./quota-tracker.js";
import { createStrategy, STRATEGY_NAMES, type Strategy } from "./strategies.js";
import { DEFAULT_COOLDOWN_MS, MAX_WAIT_BEFORE_ERROR_MS } from "./constants.js";

export interface Account {
  profileId: string;
  provider: string;
  email: string;
  isInvalid: boolean;
  invalidReason: string | null;
  lastUsed: number | null;
}

export interface AccountManagerConfig {
  strategy?: string;
  provider?: string;
  defaultCooldownMs?: number;
  maxWaitBeforeErrorMs?: number;
}

export interface AuthProfileStore {
  profiles: Record<string, {
    type: string;
    provider: string;
    email?: string;
    access?: string;
    refresh?: string;
    expires?: number;
    projectId?: string;
  }>;
}

export class AccountManager {
  private provider: string;
  private authStore: AuthProfileStore | null = null;
  private accounts = new Map<string, Account>();
  private strategy: Strategy;
  private defaultCooldownMs: number;
  private invalidProfiles = new Set<string>();
  private tokenCache = new Map<string, string>();
  private projectCache = new Map<string, string>();

  public rateLimitTracker = new RateLimitTracker();
  public healthScorer = new HealthScorer();
  public quotaTracker = new QuotaTracker();

  constructor(config: AccountManagerConfig = {}) {
    this.provider = config.provider ?? "google-antigravity";
    this.defaultCooldownMs = config.defaultCooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.strategy = createStrategy(config.strategy ?? "hybrid");
    this.strategy.init(this);
  }

  async initialize(
    authStore: AuthProfileStore,
    strategyOverride?: string
  ): Promise<this> {
    this.authStore = authStore;

    if (strategyOverride && STRATEGY_NAMES.includes(strategyOverride.toLowerCase() as any)) {
      this.strategy = createStrategy(strategyOverride);
      this.strategy.init(this);
    }

    this.loadAccountsFromStore();
    return this;
  }

  private loadAccountsFromStore(): void {
    if (!this.authStore?.profiles) return;

    for (const [profileId, profile] of Object.entries(this.authStore.profiles)) {
      if (profile.provider !== this.provider) continue;
      if (profile.type !== "oauth") continue;

      this.accounts.set(profileId, {
        profileId,
        provider: profile.provider,
        email: profile.email ?? profileId,
        isInvalid: this.invalidProfiles.has(profileId),
        invalidReason: null,
        lastUsed: null,
      });
    }
  }

  getProfilesForProvider(): string[] {
    return Array.from(this.accounts.keys()).filter(
      (id) => !this.invalidProfiles.has(id)
    );
  }

  getAccountByProfileId(profileId: string): Account | null {
    return this.accounts.get(profileId) ?? null;
  }

  getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  getAccountCount(): number {
    return this.accounts.size;
  }

  getAvailableAccounts(modelId: string): Account[] {
    return this.getProfilesForProvider()
      .filter((id) => !this.rateLimitTracker.isRateLimited(id, modelId))
      .map((id) => this.accounts.get(id)!)
      .filter(Boolean);
  }

  selectAccount(modelId: string): { account: Account | null; waitMs: number } {
    this.rateLimitTracker.clearExpired();
    return this.strategy.select(modelId) as { account: Account | null; waitMs: number };
  }

  notifySuccess(profileId: string, modelId: string): void {
    this.rateLimitTracker.clearRateLimit(profileId, modelId);
    this.healthScorer.recordSuccess(profileId);
    this.strategy.notifySuccess(profileId, modelId);

    const account = this.accounts.get(profileId);
    if (account) account.lastUsed = Date.now();
  }

  notifyRateLimit(profileId: string, modelId: string, cooldownMs?: number): void {
    this.markRateLimited(profileId, modelId, cooldownMs);
    this.healthScorer.recordRateLimit(profileId);
    this.strategy.notifyRateLimit(profileId, modelId);
  }

  notifyFailure(profileId: string, _modelId: string): void {
    this.healthScorer.recordFailure(profileId);
    this.rateLimitTracker.incrementFailures(profileId);

    if (this.rateLimitTracker.shouldExtendCooldown(profileId)) {
      this.rateLimitTracker.applyExtendedCooldown(profileId);
    }
  }

  markRateLimited(profileId: string, modelId: string, cooldownMs?: number): void {
    this.rateLimitTracker.markRateLimited(
      profileId,
      modelId,
      cooldownMs ?? this.defaultCooldownMs
    );
  }

  markInvalid(profileId: string, reason: string): void {
    this.invalidProfiles.add(profileId);
    const account = this.accounts.get(profileId);
    if (account) {
      account.isInvalid = true;
      account.invalidReason = reason;
    }
  }

  isAllRateLimited(modelId: string): boolean {
    const profiles = this.getProfilesForProvider();
    return this.rateLimitTracker.areAllRateLimited(profiles, modelId);
  }

  getMinWaitTimeMs(modelId: string): number {
    const profiles = this.getProfilesForProvider();
    return this.rateLimitTracker.getMinWaitTime(profiles, modelId);
  }

  resetAllRateLimits(): void {
    this.rateLimitTracker.clearExpired();
  }

  clearExpiredLimits(): void {
    this.rateLimitTracker.clearExpired();
  }

  getConsecutiveFailures(profileId: string): number {
    return this.rateLimitTracker.getFailureCount(profileId);
  }

  async getTokenForAccount(account: Account): Promise<string> {
    const cached = this.tokenCache.get(account.profileId);
    if (cached) return cached;

    const profile = this.authStore?.profiles?.[account.profileId];
    if (!profile || profile.type !== "oauth") {
      throw new Error(`No OAuth credentials for ${account.profileId}`);
    }

    if (profile.expires && Date.now() >= profile.expires) {
      throw new Error(`Token expired for ${account.profileId}`);
    }

    const token = profile.access;
    if (!token) throw new Error(`No access token for ${account.profileId}`);

    this.tokenCache.set(account.profileId, token);
    return token;
  }

  async getProjectForAccount(account: Account): Promise<string> {
    const cached = this.projectCache.get(account.profileId);
    if (cached) return cached;

    const profile = this.authStore?.profiles?.[account.profileId];
    const projectId = profile?.projectId;
    if (projectId) {
      this.projectCache.set(account.profileId, projectId);
      return projectId;
    }

    throw new Error(`No project ID for ${account.profileId}`);
  }

  clearTokenCache(profileId?: string): void {
    if (profileId) this.tokenCache.delete(profileId);
    else this.tokenCache.clear();
  }

  clearProjectCache(profileId?: string): void {
    if (profileId) this.projectCache.delete(profileId);
    else this.projectCache.clear();
  }

  getStrategyLabel(): string {
    return this.strategy.getLabel();
  }

  getStatus() {
    const profiles = this.getProfilesForProvider();
    const invalid = Array.from(this.invalidProfiles);
    const rateLimited = profiles.filter(
      (id) => this.rateLimitTracker.getSoonestReset(id) !== null
    );
    const available = profiles.filter(
      (id) => !rateLimited.includes(id) && !invalid.includes(id)
    );

    return {
      total: profiles.length + invalid.length,
      available: available.length,
      rateLimited: rateLimited.length,
      invalid: invalid.length,
      summary: `${available.length}/${profiles.length + invalid.length} available`,
      accounts: this.getAllAccounts().map((acc) => ({
        email: acc.email,
        isInvalid: acc.isInvalid,
        invalidReason: acc.invalidReason,
        lastUsed: acc.lastUsed,
        healthScore: this.healthScorer.getScore(acc.profileId),
      })),
    };
  }

  toJSON() {
    return {
      provider: this.provider,
      invalidProfiles: Array.from(this.invalidProfiles),
      rateLimits: this.rateLimitTracker.toJSON(),
      health: this.healthScorer.toJSON(),
      quotas: this.quotaTracker.toJSON(),
    };
  }

  fromJSON(data: ReturnType<typeof this.toJSON>): void {
    if (data?.invalidProfiles) {
      for (const id of data.invalidProfiles) this.invalidProfiles.add(id);
    }
    if (data?.rateLimits) this.rateLimitTracker.fromJSON(data.rateLimits);
    if (data?.health) this.healthScorer.fromJSON(data.health);
    if (data?.quotas) this.quotaTracker.fromJSON(data.quotas);
  }
}
