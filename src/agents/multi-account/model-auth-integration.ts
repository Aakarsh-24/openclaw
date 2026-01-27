/**
 * Multi-Account Integration for Model Auth
 *
 * Drop-in enhancement for resolveApiKeyForProvider that enables
 * multi-account load balancing when configured.
 */

import type { AuthProfileStore } from "../auth-profiles.js";
import { AccountManager, type Account } from "./account-manager.js";
import { normalizeProviderId } from "../model-selection.js";

// Singleton managers per provider
const managers = new Map<string, AccountManager>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClawdbotConfig = any;

export interface MultiAccountConfig {
  enabled?: boolean;
  strategy?: "hybrid" | "sticky" | "round-robin";
  providers?: string[];
  defaultCooldownMs?: number;
}

export function getMultiAccountConfig(cfg?: ClawdbotConfig): MultiAccountConfig | null {
  const multiAccount = cfg?.auth?.multiAccount;
  if (!multiAccount?.enabled) return null;
  return multiAccount as MultiAccountConfig;
}

export function isMultiAccountEnabled(provider: string, cfg?: ClawdbotConfig): boolean {
  const config = getMultiAccountConfig(cfg);
  if (!config) return false;

  const providers = config.providers ?? ["google-antigravity"];
  const normalized = normalizeProviderId(provider);
  return providers.some((p) => normalizeProviderId(p) === normalized);
}

export async function getOrCreateManager(
  provider: string,
  store: AuthProfileStore,
  cfg?: ClawdbotConfig
): Promise<AccountManager> {
  const normalized = normalizeProviderId(provider);

  if (managers.has(normalized)) {
    return managers.get(normalized)!;
  }

  const config = getMultiAccountConfig(cfg);
  const manager = new AccountManager({
    provider: normalized,
    strategy: config?.strategy ?? "hybrid",
    defaultCooldownMs: config?.defaultCooldownMs,
  });

  await manager.initialize(store, config?.strategy);
  managers.set(normalized, manager);

  return manager;
}

export function getManager(provider: string): AccountManager | undefined {
  return managers.get(normalizeProviderId(provider));
}

export interface MultiAccountSelection {
  account: Account;
  manager: AccountManager;
  profileId: string;
}

export async function selectAccountForModel(params: {
  provider: string;
  modelId: string;
  cfg?: ClawdbotConfig;
  store: AuthProfileStore;
}): Promise<MultiAccountSelection | null> {
  const { provider, modelId, cfg, store } = params;

  if (!isMultiAccountEnabled(provider, cfg)) {
    return null;
  }

  const manager = await getOrCreateManager(provider, store, cfg);

  // Need at least 2 accounts for multi-account to be useful
  if (manager.getAccountCount() < 2) {
    return null;
  }

  const { account, waitMs } = manager.selectAccount(modelId);

  if (!account) {
    if (waitMs > 0) {
      const waitSec = Math.ceil(waitMs / 1000);
      throw new Error(
        `All ${manager.getAccountCount()} accounts rate-limited for ${modelId}. ` +
          `Shortest wait: ${waitSec}s. Try again later.`
      );
    }
    return null;
  }

  return {
    account,
    manager,
    profileId: account.profileId,
  };
}

export function notifyMultiAccountSuccess(
  selection: MultiAccountSelection | null | undefined,
  modelId: string
): void {
  if (!selection) return;
  selection.manager.notifySuccess(selection.profileId, modelId);
}

export function notifyMultiAccountRateLimit(
  selection: MultiAccountSelection | null | undefined,
  modelId: string,
  cooldownMs?: number
): void {
  if (!selection) return;
  selection.manager.notifyRateLimit(selection.profileId, modelId, cooldownMs);
}

export function notifyMultiAccountFailure(
  selection: MultiAccountSelection | null | undefined,
  modelId: string
): void {
  if (!selection) return;
  selection.manager.notifyFailure(selection.profileId, modelId);
}

export function notifyMultiAccountInvalid(
  selection: MultiAccountSelection | null | undefined,
  reason: string
): void {
  if (!selection) return;
  selection.manager.markInvalid(selection.profileId, reason);
}

export function getMultiAccountStatus(): Record<
  string,
  ReturnType<AccountManager["getStatus"]>
> {
  const status: Record<string, ReturnType<AccountManager["getStatus"]>> = {};
  for (const [provider, manager] of managers) {
    status[provider] = manager.getStatus();
  }
  return status;
}

export function clearAllManagers(): void {
  managers.clear();
}

export function resetManagerState(provider: string): void {
  const manager = managers.get(normalizeProviderId(provider));
  if (manager) {
    manager.resetAllRateLimits();
  }
}
