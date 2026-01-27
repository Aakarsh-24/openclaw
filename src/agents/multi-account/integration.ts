/**
 * Multi-Account Integration for Pi Runner
 *
 * This module provides hooks to integrate multi-account load balancing
 * with Clawdbot's pi-embedded-runner.
 */

import { AccountManager, type AuthProfileStore } from "./account-manager.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClawdbotConfig = any;

// Singleton managers per provider
const managers = new Map<string, AccountManager>();

/**
 * Get or create an AccountManager for a provider
 */
export async function getAccountManager(
  provider: string,
  authStore: AuthProfileStore,
  cfg?: ClawdbotConfig
): Promise<AccountManager> {
  if (managers.has(provider)) {
    return managers.get(provider)!;
  }

  const multiAccountConfig = (cfg as any)?.auth?.multiAccount;
  const manager = new AccountManager({
    provider,
    strategy: multiAccountConfig?.strategy ?? "hybrid",
    defaultCooldownMs: multiAccountConfig?.defaultCooldownMs,
  });

  await manager.initialize(authStore, multiAccountConfig?.strategy);
  managers.set(provider, manager);

  return manager;
}

/**
 * Check if multi-account is enabled for a provider
 */
export function isMultiAccountEnabled(
  provider: string,
  cfg?: ClawdbotConfig
): boolean {
  const multiAccountConfig = (cfg as any)?.auth?.multiAccount;
  if (!multiAccountConfig?.enabled) return false;

  const providerList = multiAccountConfig?.providers ?? ["google-antigravity"];
  return providerList.includes(provider);
}

/**
 * Resolve API key using multi-account load balancing
 *
 * Returns null if multi-account is not available, signaling to use default resolver.
 */
export async function resolveWithMultiAccount(params: {
  provider: string;
  modelId: string;
  cfg?: ClawdbotConfig;
  authStore: AuthProfileStore;
}): Promise<{
  apiKey: string;
  profileId: string;
  source: string;
  mode: "oauth";
  _manager: AccountManager;
  _profileId: string;
} | null> {
  const { provider, modelId, cfg, authStore } = params;

  // Check if enabled
  if (!isMultiAccountEnabled(provider, cfg)) {
    return null;
  }

  const manager = await getAccountManager(provider, authStore, cfg);

  // Check if we have multiple accounts
  if (manager.getAccountCount() <= 1) {
    return null;
  }

  // Select account
  const { account, waitMs } = manager.selectAccount(modelId);

  if (!account) {
    if (waitMs > 0) {
      const minWait = manager.getMinWaitTimeMs(modelId);
      throw new Error(
        `MULTI_ACCOUNT_EXHAUSTED: All accounts rate limited for ${modelId}. ` +
        `Wait ${Math.ceil(minWait / 1000)}s.`
      );
    }
    return null;
  }

  // Get credentials
  const token = await manager.getTokenForAccount(account);
  const projectId = await manager.getProjectForAccount(account);

  return {
    apiKey: JSON.stringify({ token, projectId }),
    profileId: account.profileId,
    source: `multi-account:${account.email}`,
    mode: "oauth",
    _manager: manager,
    _profileId: account.profileId,
  };
}

/**
 * Report success to account manager
 */
export function reportMultiAccountSuccess(
  result: { _manager?: AccountManager; _profileId?: string } | null,
  modelId: string
): void {
  if (!result?._manager || !result?._profileId) return;
  result._manager.notifySuccess(result._profileId, modelId);
}

/**
 * Report rate limit to account manager
 */
export function reportMultiAccountRateLimit(
  result: { _manager?: AccountManager; _profileId?: string } | null,
  modelId: string,
  cooldownMs?: number
): void {
  if (!result?._manager || !result?._profileId) return;
  result._manager.notifyRateLimit(result._profileId, modelId, cooldownMs);
}

/**
 * Report failure to account manager
 */
export function reportMultiAccountFailure(
  result: { _manager?: AccountManager; _profileId?: string } | null,
  modelId: string
): void {
  if (!result?._manager || !result?._profileId) return;
  result._manager.notifyFailure(result._profileId, modelId);
}

/**
 * Report auth invalid to account manager
 */
export function reportMultiAccountAuthInvalid(
  result: { _manager?: AccountManager; _profileId?: string } | null,
  reason: string
): void {
  if (!result?._manager || !result?._profileId) return;
  result._manager.markInvalid(result._profileId, reason);
}

/**
 * Get status of all multi-account managers
 */
export function getMultiAccountStatus(): Record<string, ReturnType<AccountManager["getStatus"]>> {
  const status: Record<string, ReturnType<AccountManager["getStatus"]>> = {};
  for (const [provider, manager] of managers) {
    status[provider] = manager.getStatus();
  }
  return status;
}

/**
 * Clear all managers (for testing)
 */
export function clearManagers(): void {
  managers.clear();
}
