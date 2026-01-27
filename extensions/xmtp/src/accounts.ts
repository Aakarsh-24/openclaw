/**
 * XMTP Multi-Account Management
 *
 * Utilities for managing multiple XMTP bot accounts in a single Clawdbot instance.
 * Follows the pattern established by Telegram and Discord channels.
 */

import { createUser } from "@xmtp/agent-sdk/user";

import type { XmtpAccountConfigInferred } from "./schemas.xmtp.js";
import type { ResolvedXmtpAccount, XmtpConfig, XmtpDmPolicy, XmtpEnv } from "./types.xmtp.js";

// Re-export the type for consumers
export type { ResolvedXmtpAccount } from "./types.xmtp.js";

// ============================================================================
// Constants
// ============================================================================

/** Default account ID when no specific account is specified */
export const DEFAULT_XMTP_ACCOUNT_ID = "default";

// ============================================================================
// Types
// ============================================================================

/**
 * Account configuration (subset of ResolvedXmtpAccount).
 * This is what's stored in the config file per account.
 */
export type XmtpAccountConfig = XmtpAccountConfigInferred;

/**
 * Configuration object passed to account resolution functions.
 * Uses flexible typing to work with both clawdbot SDK types and our internal types.
 */
export type XmtpConfigInput = Record<string, unknown> | { channels?: { xmtp?: XmtpConfig } };

// ============================================================================
// Account Resolution
// ============================================================================

/**
 * Extract XMTP config from flexible config object.
 * @internal
 */
function getXmtpConfig(cfg: XmtpConfigInput): XmtpConfig | undefined {
  const channels = (cfg as Record<string, unknown>).channels as Record<string, unknown> | undefined;
  return channels?.xmtp as XmtpConfig | undefined;
}

/**
 * List all configured XMTP account IDs.
 *
 * Returns account IDs from both:
 * - Top-level config (default account)
 * - channels.xmtp.accounts.* (named accounts)
 *
 * @param cfg - Clawdbot configuration object
 * @returns Array of account IDs
 */
export function listXmtpAccountIds(cfg: XmtpConfigInput): string[] {
  const xmtpCfg = getXmtpConfig(cfg);
  if (!xmtpCfg) return [];

  const ids: string[] = [];

  // Top-level config = default account (check both walletKey and env var)
  if (xmtpCfg.walletKey || process.env.XMTP_WALLET_KEY) {
    ids.push(DEFAULT_XMTP_ACCOUNT_ID);
  }

  // Named accounts from accounts map
  if (xmtpCfg.accounts) {
    ids.push(...Object.keys(xmtpCfg.accounts));
  }

  return ids;
}

/**
 * Resolve the default XMTP account ID.
 *
 * Priority:
 * 1. Top-level walletKey or env var → "default"
 * 2. First account in accounts map
 * 3. null (no accounts configured)
 *
 * @param cfg - Clawdbot configuration object
 * @returns Default account ID or null if no accounts
 */
export function resolveDefaultXmtpAccountId(cfg: XmtpConfigInput): string | null {
  const xmtpCfg = getXmtpConfig(cfg);
  if (!xmtpCfg) {
    // Check env var even without config section
    if (process.env.XMTP_WALLET_KEY) {
      return DEFAULT_XMTP_ACCOUNT_ID;
    }
    return null;
  }

  // Top-level walletKey = default account
  if (xmtpCfg.walletKey || process.env.XMTP_WALLET_KEY) {
    return DEFAULT_XMTP_ACCOUNT_ID;
  }

  // First named account
  if (xmtpCfg.accounts) {
    const accountIds = Object.keys(xmtpCfg.accounts);
    if (accountIds.length > 0) {
      return accountIds[0];
    }
  }

  return null;
}

/**
 * Normalize account ID.
 *
 * Converts various account identifiers to canonical form:
 * - null/undefined → default account
 * - "xmtp:accountName" → "accountName"
 * - "accountName" → "accountName"
 *
 * @param accountId - Raw account identifier
 * @param cfg - Clawdbot configuration object
 * @returns Normalized account ID
 */
export function normalizeXmtpAccountId(
  accountId: string | null | undefined,
  cfg: XmtpConfigInput
): string {
  if (!accountId) {
    return resolveDefaultXmtpAccountId(cfg) ?? DEFAULT_XMTP_ACCOUNT_ID;
  }

  // Strip xmtp: prefix if present
  const normalized = accountId.replace(/^xmtp:/i, "");

  return normalized || DEFAULT_XMTP_ACCOUNT_ID;
}

/**
 * Derive wallet address from a private key.
 *
 * @param walletKey - 0x-prefixed private key
 * @returns Wallet address or null if invalid
 */
function deriveWalletAddress(walletKey: string | null | undefined): string | null {
  if (!walletKey) return null;
  try {
    const user = createUser(walletKey as `0x${string}`);
    return user.account.address;
  } catch {
    return null;
  }
}

/**
 * Resolve a specific XMTP account configuration.
 *
 * Merges top-level config with account-specific overrides.
 * Handles both:
 * - Default account (top-level config)
 * - Named accounts (accounts.name)
 *
 * @param options - Resolution options
 * @returns Resolved account configuration or null if not found
 */
export function resolveXmtpAccount(options: {
  cfg: XmtpConfigInput;
  accountId?: string | null;
}): ResolvedXmtpAccount | null {
  const { cfg, accountId: rawAccountId } = options;
  const xmtpCfg = getXmtpConfig(cfg);

  if (!xmtpCfg) return null;

  const accountId = normalizeXmtpAccountId(rawAccountId, cfg);

  // Default account (top-level config)
  if (accountId === DEFAULT_XMTP_ACCOUNT_ID) {
    // Check environment for wallet key as fallback
    const walletKey = xmtpCfg.walletKey || process.env.XMTP_WALLET_KEY || null;
    
    if (!walletKey) {
      // No top-level walletKey, but maybe accounts exist
      // Try to fall back to first account
      const firstAccountId = resolveDefaultXmtpAccountId(cfg);
      if (firstAccountId && firstAccountId !== DEFAULT_XMTP_ACCOUNT_ID) {
        return resolveXmtpAccount({ cfg, accountId: firstAccountId });
      }
      return null;
    }

    const walletAddress = deriveWalletAddress(walletKey);
    const env = (xmtpCfg.env ?? process.env.XMTP_ENV ?? "dev") as XmtpEnv;
    const dbPath = xmtpCfg.dbPath ?? process.env.XMTP_DB_DIRECTORY ?? ".xmtp/db";
    const encryptionKey = xmtpCfg.encryptionKey ?? process.env.XMTP_DB_ENCRYPTION_KEY ?? null;
    const dmPolicy = (xmtpCfg.dmPolicy ?? "pairing") as XmtpDmPolicy;

    // Return top-level config as default account
    return {
      accountId: DEFAULT_XMTP_ACCOUNT_ID,
      name: xmtpCfg.name ?? null,
      enabled: xmtpCfg.enabled ?? true,
      configured: Boolean(walletKey),
      walletKey,
      walletAddress,
      env,
      dbPath,
      encryptionKey,
      config: {
        dmPolicy,
        allowFrom: xmtpCfg.allowFrom ?? [],
      },
    };
  }

  // Named account from accounts map
  if (!xmtpCfg.accounts || !xmtpCfg.accounts[accountId]) {
    return null;
  }

  const accountCfg = xmtpCfg.accounts[accountId];
  if (!accountCfg) return null;

  // Named account can inherit walletKey from top-level or env
  const walletKey = accountCfg.walletKey ?? xmtpCfg.walletKey ?? null;
  const walletAddress = deriveWalletAddress(walletKey);
  const env = (accountCfg.env ?? xmtpCfg.env ?? "dev") as XmtpEnv;
  // Named accounts get unique dbPath by default
  const dbPath = accountCfg.dbPath ?? `.xmtp/accounts/${accountId}/db`;
  const encryptionKey = accountCfg.encryptionKey ?? xmtpCfg.encryptionKey ?? null;
  const dmPolicy = (accountCfg.dmPolicy ?? xmtpCfg.dmPolicy ?? "pairing") as XmtpDmPolicy;

  // Merge with top-level defaults
  return {
    accountId,
    name: accountCfg.name ?? accountId,
    enabled: accountCfg.enabled ?? xmtpCfg.enabled ?? true,
    configured: Boolean(walletKey),
    walletKey,
    walletAddress,
    env,
    dbPath,
    encryptionKey,
    config: {
      dmPolicy,
      allowFrom: accountCfg.allowFrom ?? xmtpCfg.allowFrom ?? [],
    },
  };
}

/**
 * Check if an account is enabled.
 *
 * @param cfg - Clawdbot configuration object
 * @param accountId - Account identifier
 * @returns true if account is enabled
 */
export function isXmtpAccountEnabled(
  cfg: XmtpConfigInput,
  accountId?: string | null
): boolean {
  const account = resolveXmtpAccount({ cfg, accountId });
  if (!account) return false;
  return account.enabled !== false;
}

/**
 * Get account by wallet address.
 *
 * Useful for routing inbound messages to the correct account.
 *
 * @param cfg - Clawdbot configuration object
 * @param address - Ethereum wallet address (normalized)
 * @returns Account ID or null if not found
 */
export function getAccountIdByAddress(
  cfg: XmtpConfigInput,
  address: string
): string | null {
  const normalizedAddress = address.toLowerCase();
  const accountIds = listXmtpAccountIds(cfg);
  
  for (const accountId of accountIds) {
    const account = resolveXmtpAccount({ cfg, accountId });
    if (account?.walletAddress?.toLowerCase() === normalizedAddress) {
      return accountId;
    }
  }
  
  return null;
}

// ============================================================================
// Account Validation
// ============================================================================

/**
 * Validate multi-account configuration.
 *
 * Checks for:
 * - Duplicate wallet keys
 * - Duplicate database paths
 * - Mixed networks (dev/production)
 *
 * @param cfg - Clawdbot configuration object
 * @returns Validation errors (empty array if valid)
 */
export function validateMultiAccountConfig(cfg: XmtpConfigInput): string[] {
  const errors: string[] = [];
  const accountIds = listXmtpAccountIds(cfg);

  if (accountIds.length === 0) return errors;

  const walletKeys = new Set<string>();
  const dbPaths = new Set<string>();
  const networks = new Set<string>();

  for (const accountId of accountIds) {
    const account = resolveXmtpAccount({ cfg, accountId });
    if (!account) continue;

    // Check for duplicate wallet keys
    if (account.walletKey) {
      if (walletKeys.has(account.walletKey)) {
        errors.push(`Duplicate wallet key in account "${accountId}"`);
      }
      walletKeys.add(account.walletKey);
    }

    // Check for duplicate database paths
    if (account.dbPath) {
      if (dbPaths.has(account.dbPath)) {
        errors.push(
          `Duplicate database path "${account.dbPath}" in account "${accountId}". Each account needs a unique dbPath.`
        );
      }
      dbPaths.add(account.dbPath);
    }

    // Track networks for mixed-network warning
    if (account.env) {
      networks.add(account.env);
    }
  }

  // Warn about mixed networks (not an error, but potentially confusing)
  if (networks.size > 1) {
    errors.push(
      `Warning: Multiple networks configured (${Array.from(networks).join(", ")}). Ensure this is intentional.`
    );
  }

  return errors;
}

// ============================================================================
// Exports
// ============================================================================

// XmtpConfigInput type exported for consumers needing the flexible config type
