#!/usr/bin/env tsx
/**
 * XMTP Plugin Multi-Account Tests
 *
 * Tests for multi-account functionality:
 * - Account listing and resolution
 * - Default account resolution
 * - Account normalization
 * - Multi-account validation
 * - Address-based account lookup
 */

import { describe, test, expect } from "./test-helpers.js";
import {
  DEFAULT_XMTP_ACCOUNT_ID,
  listXmtpAccountIds,
  normalizeXmtpAccountId,
  resolveDefaultXmtpAccountId,
  resolveXmtpAccount,
  validateMultiAccountConfig,
  getAccountIdByAddress,
  isXmtpAccountEnabled,
} from "../accounts.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const VALID_WALLET_KEY =
  "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const VALID_WALLET_KEY_2 =
  "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

// Empty config
const emptyConfig = {};

// Config with no XMTP section
const noXmtpConfig = { channels: {} };

// Single-account config (top-level walletKey)
const singleAccountConfig = {
  channels: {
    xmtp: {
      walletKey: VALID_WALLET_KEY,
      env: "dev",
      dbPath: ".xmtp/db",
    },
  },
};

// Third wallet key for staging
const VALID_WALLET_KEY_3 =
  "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

// Multi-account config (same network to avoid mixed network warnings)
const multiAccountConfig = {
  channels: {
    xmtp: {
      // Default account
      walletKey: VALID_WALLET_KEY,
      env: "dev",
      // Named accounts
      accounts: {
        main: {
          walletKey: VALID_WALLET_KEY_2,
          env: "dev",
          dbPath: ".xmtp/accounts/main/db",
        },
        staging: {
          name: "Staging Bot",
          enabled: false,
          walletKey: VALID_WALLET_KEY_3, // Unique key to avoid duplicate
          env: "dev",
          dbPath: ".xmtp/accounts/staging/db",
        },
      },
    },
  },
};

// Named accounts only (no top-level walletKey)
const namedAccountsOnlyConfig = {
  channels: {
    xmtp: {
      env: "dev",
      accounts: {
        primary: {
          walletKey: VALID_WALLET_KEY,
          dbPath: ".xmtp/accounts/primary/db",
        },
        secondary: {
          walletKey: VALID_WALLET_KEY_2,
          dbPath: ".xmtp/accounts/secondary/db",
        },
      },
    },
  },
};

// Config with duplicate wallet keys (invalid)
const duplicateKeysConfig = {
  channels: {
    xmtp: {
      walletKey: VALID_WALLET_KEY,
      accounts: {
        duplicate: {
          walletKey: VALID_WALLET_KEY, // Same as top-level
          dbPath: ".xmtp/accounts/duplicate/db",
        },
      },
    },
  },
};

// Config with duplicate db paths (invalid)
const duplicateDbPathsConfig = {
  channels: {
    xmtp: {
      walletKey: VALID_WALLET_KEY,
      accounts: {
        dup: {
          walletKey: VALID_WALLET_KEY_2,
          dbPath: ".xmtp/db", // Same as default
        },
      },
    },
  },
};

// Config with mixed networks
const mixedNetworksConfig = {
  channels: {
    xmtp: {
      walletKey: VALID_WALLET_KEY,
      env: "dev",
      accounts: {
        prod: {
          walletKey: VALID_WALLET_KEY_2,
          env: "production",
          dbPath: ".xmtp/accounts/prod/db",
        },
      },
    },
  },
};

// ============================================================================
// listXmtpAccountIds Tests
// ============================================================================

describe("listXmtpAccountIds", () => {
  test("returns empty array for empty config", () => {
    expect(listXmtpAccountIds(emptyConfig)).toEqual([]);
  });

  test("returns empty array for no XMTP section", () => {
    expect(listXmtpAccountIds(noXmtpConfig)).toEqual([]);
  });

  test("returns default account for single-account config", () => {
    const ids = listXmtpAccountIds(singleAccountConfig);
    expect(ids).toContain(DEFAULT_XMTP_ACCOUNT_ID);
    expect(ids).toHaveLength(1);
  });

  test("returns all accounts for multi-account config", () => {
    const ids = listXmtpAccountIds(multiAccountConfig);
    expect(ids).toContain(DEFAULT_XMTP_ACCOUNT_ID);
    expect(ids).toContain("main");
    expect(ids).toContain("staging");
    expect(ids).toHaveLength(3);
  });

  test("returns only named accounts when no top-level walletKey", () => {
    const ids = listXmtpAccountIds(namedAccountsOnlyConfig);
    expect(ids).toContain("primary");
    expect(ids).toContain("secondary");
    expect(ids).toHaveLength(2);
  });
});

// ============================================================================
// resolveDefaultXmtpAccountId Tests
// ============================================================================

describe("resolveDefaultXmtpAccountId", () => {
  test("returns null for empty config", () => {
    expect(resolveDefaultXmtpAccountId(emptyConfig)).toBe(null);
  });

  test("returns default for single-account config", () => {
    expect(resolveDefaultXmtpAccountId(singleAccountConfig)).toBe(DEFAULT_XMTP_ACCOUNT_ID);
  });

  test("returns default for multi-account config with top-level key", () => {
    expect(resolveDefaultXmtpAccountId(multiAccountConfig)).toBe(DEFAULT_XMTP_ACCOUNT_ID);
  });

  test("returns first named account when no top-level key", () => {
    const result = resolveDefaultXmtpAccountId(namedAccountsOnlyConfig);
    // Should be one of the named accounts (order may vary)
    expect(result === "primary" || result === "secondary").toBe(true);
  });
});

// ============================================================================
// normalizeXmtpAccountId Tests
// ============================================================================

describe("normalizeXmtpAccountId", () => {
  test("returns default account ID for null", () => {
    const result = normalizeXmtpAccountId(null, singleAccountConfig);
    expect(result).toBe(DEFAULT_XMTP_ACCOUNT_ID);
  });

  test("returns default account ID for undefined", () => {
    const result = normalizeXmtpAccountId(undefined, singleAccountConfig);
    expect(result).toBe(DEFAULT_XMTP_ACCOUNT_ID);
  });

  test("returns default account ID for empty string", () => {
    const result = normalizeXmtpAccountId("", singleAccountConfig);
    expect(result).toBe(DEFAULT_XMTP_ACCOUNT_ID);
  });

  test("strips xmtp: prefix", () => {
    const result = normalizeXmtpAccountId("xmtp:main", multiAccountConfig);
    expect(result).toBe("main");
  });

  test("strips XMTP: prefix (case insensitive)", () => {
    const result = normalizeXmtpAccountId("XMTP:main", multiAccountConfig);
    expect(result).toBe("main");
  });

  test("passes through valid account ID", () => {
    const result = normalizeXmtpAccountId("main", multiAccountConfig);
    expect(result).toBe("main");
  });
});

// ============================================================================
// resolveXmtpAccount Tests
// ============================================================================

describe("resolveXmtpAccount", () => {
  test("returns null for empty config", () => {
    const result = resolveXmtpAccount({ cfg: emptyConfig });
    expect(result).toBe(null);
  });

  test("returns null for no XMTP section", () => {
    const result = resolveXmtpAccount({ cfg: noXmtpConfig });
    expect(result).toBe(null);
  });

  test("resolves default account from single-account config", () => {
    const result = resolveXmtpAccount({ cfg: singleAccountConfig });
    expect(result).toBeDefined();
    expect(result!.accountId).toBe(DEFAULT_XMTP_ACCOUNT_ID);
    expect(result!.walletKey).toBe(VALID_WALLET_KEY);
    expect(result!.env).toBe("dev");
    expect(result!.configured).toBe(true);
  });

  test("resolves named account from multi-account config", () => {
    const result = resolveXmtpAccount({ cfg: multiAccountConfig, accountId: "main" });
    expect(result).toBeDefined();
    expect(result!.accountId).toBe("main");
    expect(result!.walletKey).toBe(VALID_WALLET_KEY_2);
    expect(result!.env).toBe("dev");
  });

  test("resolves account with custom name", () => {
    const result = resolveXmtpAccount({ cfg: multiAccountConfig, accountId: "staging" });
    expect(result).toBeDefined();
    expect(result!.name).toBe("Staging Bot");
    expect(result!.enabled).toBe(false);
  });

  test("returns null for non-existent account", () => {
    const result = resolveXmtpAccount({ cfg: multiAccountConfig, accountId: "nonexistent" });
    expect(result).toBe(null);
  });

  test("falls back to first named account when default has no walletKey", () => {
    const result = resolveXmtpAccount({ cfg: namedAccountsOnlyConfig });
    expect(result).toBeDefined();
    // Should fall back to one of the named accounts
    expect(result!.accountId === "primary" || result!.accountId === "secondary").toBe(true);
  });

  test("includes wallet address when walletKey is valid", () => {
    const result = resolveXmtpAccount({ cfg: singleAccountConfig });
    expect(result).toBeDefined();
    expect(result!.walletAddress).toBeDefined();
    // walletAddress should not be null
    expect(result!.walletAddress !== null).toBe(true);
    // Should be a valid Ethereum address
    expect(result!.walletAddress!.startsWith("0x")).toBe(true);
    expect(result!.walletAddress!.length).toBe(42);
  });

  test("sets configured to true when walletKey present", () => {
    const result = resolveXmtpAccount({ cfg: singleAccountConfig });
    expect(result!.configured).toBe(true);
  });

  test("includes config with dmPolicy and allowFrom", () => {
    const result = resolveXmtpAccount({ cfg: singleAccountConfig });
    expect(result!.config).toBeDefined();
    expect(result!.config.dmPolicy).toBe("pairing");
    expect(result!.config.allowFrom).toEqual([]);
  });
});

// ============================================================================
// isXmtpAccountEnabled Tests
// ============================================================================

describe("isXmtpAccountEnabled", () => {
  test("returns false for empty config", () => {
    expect(isXmtpAccountEnabled(emptyConfig)).toBe(false);
  });

  test("returns true for enabled account", () => {
    expect(isXmtpAccountEnabled(singleAccountConfig)).toBe(true);
  });

  test("returns false for explicitly disabled account", () => {
    expect(isXmtpAccountEnabled(multiAccountConfig, "staging")).toBe(false);
  });

  test("returns true for named account without enabled field", () => {
    expect(isXmtpAccountEnabled(multiAccountConfig, "main")).toBe(true);
  });
});

// ============================================================================
// getAccountIdByAddress Tests
// ============================================================================

describe("getAccountIdByAddress", () => {
  test("returns null for empty config", () => {
    expect(getAccountIdByAddress(emptyConfig, "0x1234")).toBe(null);
  });

  test("returns null for unknown address", () => {
    expect(getAccountIdByAddress(singleAccountConfig, "0xunknown")).toBe(null);
  });

  test("finds account by wallet address", () => {
    // First get the resolved address
    const account = resolveXmtpAccount({ cfg: singleAccountConfig });
    expect(account).toBeDefined();
    const address = account!.walletAddress!;

    // Then look it up
    const result = getAccountIdByAddress(singleAccountConfig, address);
    expect(result).toBe(DEFAULT_XMTP_ACCOUNT_ID);
  });

  test("handles case-insensitive address matching", () => {
    const account = resolveXmtpAccount({ cfg: singleAccountConfig });
    expect(account).toBeDefined();
    const address = account!.walletAddress!;

    // Try with uppercase
    const result = getAccountIdByAddress(singleAccountConfig, address.toUpperCase());
    expect(result).toBe(DEFAULT_XMTP_ACCOUNT_ID);
  });
});

// ============================================================================
// validateMultiAccountConfig Tests
// ============================================================================

describe("validateMultiAccountConfig", () => {
  test("returns empty array for valid single-account config", () => {
    const errors = validateMultiAccountConfig(singleAccountConfig);
    expect(errors).toHaveLength(0);
  });

  test("returns no errors for valid multi-account config (may have warnings)", () => {
    const errors = validateMultiAccountConfig(multiAccountConfig);
    // May have mixed network warning, but no actual errors
    const actualErrors = errors.filter((e) => !e.startsWith("Warning:"));
    expect(actualErrors).toHaveLength(0);
  });

  test("detects duplicate wallet keys", () => {
    const errors = validateMultiAccountConfig(duplicateKeysConfig);
    const duplicateErrors = errors.filter((e) => e.includes("Duplicate wallet key"));
    expect(duplicateErrors.length).toBe(1);
  });

  test("detects duplicate database paths", () => {
    const errors = validateMultiAccountConfig(duplicateDbPathsConfig);
    const duplicateErrors = errors.filter((e) => e.includes("Duplicate database path"));
    expect(duplicateErrors.length).toBe(1);
  });

  test("warns about mixed networks", () => {
    const errors = validateMultiAccountConfig(mixedNetworksConfig);
    // There should be at least one warning
    expect(errors.length > 0).toBe(true);
    // Find the mixed networks warning
    const mixedWarning = errors.find((e) => e.includes("Warning:") && e.includes("networks"));
    expect(mixedWarning !== undefined).toBe(true);
    expect(mixedWarning!.includes("dev")).toBe(true);
    expect(mixedWarning!.includes("production")).toBe(true);
  });

  test("returns empty array for empty config", () => {
    const errors = validateMultiAccountConfig(emptyConfig);
    expect(errors).toHaveLength(0);
  });
});

// ============================================================================
// DEFAULT_XMTP_ACCOUNT_ID Tests
// ============================================================================

describe("DEFAULT_XMTP_ACCOUNT_ID", () => {
  test("has expected value", () => {
    expect(DEFAULT_XMTP_ACCOUNT_ID).toBe("default");
  });
});

// ============================================================================
// Run Tests
// ============================================================================

console.log("\n=== XMTP Plugin Multi-Account Tests ===\n");
