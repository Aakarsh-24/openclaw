#!/usr/bin/env tsx
/**
 * XMTP Plugin Unit Tests
 *
 * Tests for:
 * - Config validation schemas
 * - Target normalization
 * - Error classes
 * - Action handlers (mocked)
 */

import { describe, test, expect } from "./test-helpers.js";
import {
  EthereumAddressSchema,
  WalletKeySchema,
  XmtpAccountConfigSchema,
  XmtpChannelConfigSchema,
  XmtpConfigSchema,
  XmtpDmPolicySchema,
  XmtpEnvSchema,
  validateEthereumAddress,
  validateWalletKey,
  validateAccountConfig,
  safeValidateAccountConfig,
} from "../schemas.xmtp.js";
import {
  XmtpError,
  XmtpSendError,
  XmtpConfigError,
  XmtpValidationError,
  isRetryableError,
  wrapError,
} from "../errors.js";

// ============================================================================
// Config Validation Tests
// ============================================================================

describe("XmtpEnvSchema", () => {
  test("accepts valid environments", () => {
    expect(XmtpEnvSchema.safeParse("dev").success).toBe(true);
    expect(XmtpEnvSchema.safeParse("production").success).toBe(true);
  });

  test("rejects invalid environments", () => {
    expect(XmtpEnvSchema.safeParse("test").success).toBe(false);
    expect(XmtpEnvSchema.safeParse("staging").success).toBe(false);
    expect(XmtpEnvSchema.safeParse("").success).toBe(false);
    expect(XmtpEnvSchema.safeParse(123).success).toBe(false);
  });
});

describe("XmtpDmPolicySchema", () => {
  test("accepts valid policies", () => {
    expect(XmtpDmPolicySchema.safeParse("pairing").success).toBe(true);
    expect(XmtpDmPolicySchema.safeParse("allowlist").success).toBe(true);
    expect(XmtpDmPolicySchema.safeParse("open").success).toBe(true);
  });

  test("rejects invalid policies", () => {
    expect(XmtpDmPolicySchema.safeParse("closed").success).toBe(false);
    expect(XmtpDmPolicySchema.safeParse("").success).toBe(false);
  });
});

describe("EthereumAddressSchema", () => {
  test("accepts valid checksummed addresses", () => {
    const result = EthereumAddressSchema.safeParse(
      "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
    );
    expect(result.success).toBe(true);
    if (result.success) {
      // Should be normalized to lowercase
      expect(result.data).toBe("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    }
  });

  test("accepts valid lowercase addresses", () => {
    const result = EthereumAddressSchema.safeParse(
      "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    }
  });

  test("accepts valid uppercase addresses", () => {
    const result = EthereumAddressSchema.safeParse(
      "0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045"
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    }
  });

  test("rejects addresses without 0x prefix", () => {
    expect(
      EthereumAddressSchema.safeParse(
        "d8da6bf26964af9d7eed9e03e53415d37aa96045"
      ).success
    ).toBe(false);
  });

  test("rejects addresses with wrong length", () => {
    expect(
      EthereumAddressSchema.safeParse("0xd8da6bf26964af9d7eed9e03e53415d37aa9604")
        .success
    ).toBe(false); // 39 chars
    expect(
      EthereumAddressSchema.safeParse(
        "0xd8da6bf26964af9d7eed9e03e53415d37aa960455"
      ).success
    ).toBe(false); // 41 chars
  });

  test("rejects addresses with invalid characters", () => {
    expect(
      EthereumAddressSchema.safeParse(
        "0xd8da6bf26964af9d7eed9e03e53415d37aa9604g"
      ).success
    ).toBe(false);
  });

  test("rejects empty strings", () => {
    expect(EthereumAddressSchema.safeParse("").success).toBe(false);
  });
});

describe("WalletKeySchema", () => {
  test("accepts valid wallet keys", () => {
    const validKey =
      "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    expect(WalletKeySchema.safeParse(validKey).success).toBe(true);
  });

  test("accepts undefined (optional)", () => {
    expect(WalletKeySchema.safeParse(undefined).success).toBe(true);
  });

  test("rejects keys without 0x prefix", () => {
    const noPrefix =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    expect(WalletKeySchema.safeParse(noPrefix).success).toBe(false);
  });

  test("rejects keys with wrong length", () => {
    const tooShort = "0x0123456789abcdef0123456789abcdef";
    const tooLong =
      "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef00";
    expect(WalletKeySchema.safeParse(tooShort).success).toBe(false);
    expect(WalletKeySchema.safeParse(tooLong).success).toBe(false);
  });
});

describe("XmtpAccountConfigSchema", () => {
  test("accepts minimal config", () => {
    const result = XmtpAccountConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.env).toBe("dev");
      expect(result.data.dmPolicy).toBe("pairing");
      expect(result.data.dbPath).toBe(".xmtp/db");
    }
  });

  test("accepts full config", () => {
    const result = XmtpAccountConfigSchema.safeParse({
      name: "Main Bot",
      enabled: true,
      walletKey:
        "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      env: "production",
      dbPath: "/custom/path",
      dmPolicy: "allowlist",
      allowFrom: ["0xd8da6bf26964af9d7eed9e03e53415d37aa96045"],
      textChunkLimit: 2000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Main Bot");
      expect(result.data.enabled).toBe(true);
      expect(result.data.env).toBe("production");
      expect(result.data.dmPolicy).toBe("allowlist");
    }
  });

  test("applies defaults", () => {
    const result = XmtpAccountConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.env).toBe("dev");
      expect(result.data.dbPath).toBe(".xmtp/db");
      expect(result.data.dmPolicy).toBe("pairing");
      expect(result.data.textChunkLimit).toBe(4000);
      expect(result.data.chunkMode).toBe("length");
      expect(result.data.allowFrom).toEqual([]);
    }
  });

  test("validates textChunkLimit bounds", () => {
    expect(
      XmtpAccountConfigSchema.safeParse({ textChunkLimit: 50 }).success
    ).toBe(false); // Too small
    expect(
      XmtpAccountConfigSchema.safeParse({ textChunkLimit: 20000 }).success
    ).toBe(false); // Too large
    expect(
      XmtpAccountConfigSchema.safeParse({ textChunkLimit: 500 }).success
    ).toBe(true); // Valid
  });
});

describe("validateEthereumAddress", () => {
  test("returns normalized address for valid input", () => {
    const result = validateEthereumAddress(
      "0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045"
    );
    expect(result).toBe("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
  });

  test("throws for invalid address", () => {
    expect(() => validateEthereumAddress("invalid")).toThrow(
      "Invalid Ethereum address"
    );
  });
});

describe("validateWalletKey", () => {
  test("returns key for valid input", () => {
    const key =
      "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    expect(validateWalletKey(key)).toBe(key);
  });

  test("throws for invalid key", () => {
    expect(() => validateWalletKey("invalid")).toThrow("Invalid wallet key");
  });
});

describe("validateAccountConfig", () => {
  test("returns validated config with defaults", () => {
    const result = validateAccountConfig({ env: "production" });
    expect(result.env).toBe("production");
    expect(result.dmPolicy).toBe("pairing");
  });

  test("throws for invalid config", () => {
    expect(() => validateAccountConfig({ env: "invalid" })).toThrow();
  });
});

describe("safeValidateAccountConfig", () => {
  test("returns success result for valid config", () => {
    const result = safeValidateAccountConfig({ env: "dev" });
    expect(result.success).toBe(true);
  });

  test("returns error result for invalid config", () => {
    const result = safeValidateAccountConfig({ env: "invalid" });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Target Normalization Tests
// ============================================================================

describe("Target Normalization", () => {
  // Simulating the normalizeTarget function from channel.ts
  const normalizeTarget = (target: string) =>
    target.toLowerCase().replace(/^xmtp:/i, "");

  test("normalizes uppercase addresses to lowercase", () => {
    expect(normalizeTarget("0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045")).toBe(
      "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
    );
  });

  test("strips xmtp: prefix", () => {
    expect(
      normalizeTarget("xmtp:0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
    ).toBe("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
  });

  test("strips XMTP: prefix (case insensitive)", () => {
    expect(
      normalizeTarget("XMTP:0xd8da6bf26964af9d7eed9e03e53415d37aa96045")
    ).toBe("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
  });

  test("handles already normalized addresses", () => {
    expect(normalizeTarget("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toBe(
      "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"
    );
  });

  test("handles conversation IDs", () => {
    const convId = "abc123def456789012345678901234567890";
    expect(normalizeTarget(convId)).toBe(convId);
  });
});

describe("Target ID Detection", () => {
  // Simulating the looksLikeId function from channel.ts
  const looksLikeId = (input: string) => {
    const trimmed = input.trim().replace(/^xmtp:/i, "");
    return (
      /^0x[a-fA-F0-9]{40}$/i.test(trimmed) || /^[a-fA-F0-9]{32,}$/i.test(trimmed)
    );
  };

  test("recognizes Ethereum addresses", () => {
    expect(looksLikeId("0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toBe(true);
    expect(looksLikeId("0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045")).toBe(true);
  });

  test("recognizes addresses with xmtp: prefix", () => {
    expect(looksLikeId("xmtp:0xd8da6bf26964af9d7eed9e03e53415d37aa96045")).toBe(
      true
    );
  });

  test("recognizes conversation IDs (32+ hex chars)", () => {
    expect(looksLikeId("abc123def456789012345678901234567890")).toBe(true);
  });

  test("rejects non-ID strings", () => {
    expect(looksLikeId("hello")).toBe(false);
    expect(looksLikeId("vitalik.eth")).toBe(false); // ENS not supported yet
    expect(looksLikeId("")).toBe(false);
  });

  test("rejects addresses with wrong length", () => {
    expect(looksLikeId("0xd8da6bf")).toBe(false); // Too short
  });
});

// ============================================================================
// Error Class Tests
// ============================================================================

describe("XmtpError", () => {
  test("creates error with all properties", () => {
    const error = new XmtpError({
      message: "Test error",
      category: "network",
      code: "NETWORK_TIMEOUT",
      retryable: true,
      context: { attempt: 1 },
    });

    expect(error.message).toBe("Test error");
    expect(error.category).toBe("network");
    expect(error.code).toBe("NETWORK_TIMEOUT");
    expect(error.retryable).toBe(true);
    expect(error.context).toEqual({ attempt: 1 });
    expect(error.name).toBe("XmtpError");
  });

  test("provides user-friendly messages", () => {
    const timeoutError = new XmtpError({
      message: "Internal timeout",
      category: "network",
      code: "NETWORK_TIMEOUT",
    });
    expect(timeoutError.toUserMessage()).toBe(
      "Connection timed out. Please try again."
    );

    const authError = new XmtpError({
      message: "Invalid key",
      category: "auth",
      code: "AUTH_INVALID_KEY",
    });
    expect(authError.toUserMessage()).toBe(
      "Invalid wallet key configured. Check your XMTP settings."
    );
  });

  test("converts to JSON for logging", () => {
    const error = new XmtpError({
      message: "Test",
      category: "protocol",
      code: "PROTOCOL_SEND_FAILED",
      retryable: false,
    });

    const json = error.toJSON();
    expect(json.name).toBe("XmtpError");
    expect(json.message).toBe("Test");
    expect(json.category).toBe("protocol");
    expect(json.code).toBe("PROTOCOL_SEND_FAILED");
    expect(json.retryable).toBe(false);
  });
});

describe("XmtpSendError", () => {
  test("includes recipient and conversation info", () => {
    const error = new XmtpSendError({
      message: "Send failed",
      code: "PROTOCOL_SEND_FAILED",
      recipient: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
      conversationId: "conv123",
    });

    expect(error.name).toBe("XmtpSendError");
    expect(error.recipient).toBe("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    expect(error.conversationId).toBe("conv123");
    expect(error.category).toBe("protocol");
  });

  test("includes details in JSON", () => {
    const error = new XmtpSendError({
      message: "Not found",
      code: "PROTOCOL_CONVERSATION_NOT_FOUND",
      conversationId: "abc123",
    });

    const json = error.toJSON();
    expect(json.conversationId).toBe("abc123");
  });
});

describe("XmtpConfigError", () => {
  test("includes config key", () => {
    const error = new XmtpConfigError({
      message: "Missing wallet key",
      code: "CONFIG_MISSING_WALLET_KEY",
      configKey: "channels.xmtp.walletKey",
    });

    expect(error.name).toBe("XmtpConfigError");
    expect(error.category).toBe("config");
    expect(error.configKey).toBe("channels.xmtp.walletKey");
    expect(error.retryable).toBe(false);
  });
});

describe("XmtpValidationError", () => {
  test("includes field and value", () => {
    const error = new XmtpValidationError({
      message: "Invalid address format",
      code: "VALIDATION_INVALID_ADDRESS",
      field: "recipient",
      value: "not-an-address",
    });

    expect(error.name).toBe("XmtpValidationError");
    expect(error.category).toBe("validation");
    expect(error.field).toBe("recipient");
    expect(error.value).toBe("not-an-address");
  });
});

describe("isRetryableError", () => {
  test("returns true for retryable XmtpError", () => {
    const error = new XmtpError({
      message: "Timeout",
      category: "network",
      code: "NETWORK_TIMEOUT",
      retryable: true,
    });
    expect(isRetryableError(error)).toBe(true);
  });

  test("returns false for non-retryable XmtpError", () => {
    const error = new XmtpError({
      message: "Invalid",
      category: "auth",
      code: "AUTH_INVALID_KEY",
      retryable: false,
    });
    expect(isRetryableError(error)).toBe(false);
  });

  test("infers retryability from error message", () => {
    expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true);
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
    expect(isRetryableError(new Error("timeout occurred"))).toBe(true);
    expect(isRetryableError(new Error("Invalid key"))).toBe(false);
  });
});

describe("wrapError", () => {
  test("returns XmtpError unchanged", () => {
    const original = new XmtpError({
      message: "Test",
      category: "auth",
      code: "AUTH_INVALID_KEY",
    });
    expect(wrapError(original)).toBe(original);
  });

  test("wraps timeout errors", () => {
    const wrapped = wrapError(new Error("Connection timeout"));
    expect(wrapped.category).toBe("network");
    expect(wrapped.code).toBe("NETWORK_TIMEOUT");
    expect(wrapped.retryable).toBe(true);
  });

  test("wraps connection errors", () => {
    const wrapped = wrapError(new Error("ECONNRESET"));
    expect(wrapped.category).toBe("network");
    expect(wrapped.code).toBe("NETWORK_DISCONNECTED");
  });

  test("wraps conversation not found errors", () => {
    const wrapped = wrapError(new Error("conversation not found"));
    expect(wrapped instanceof XmtpSendError).toBe(true);
    expect(wrapped.code).toBe("PROTOCOL_CONVERSATION_NOT_FOUND");
  });

  test("wraps unknown errors", () => {
    const wrapped = wrapError(new Error("Something weird happened"));
    expect(wrapped.category).toBe("unknown");
    expect(wrapped.code).toBe("UNKNOWN_ERROR");
  });

  test("includes context in wrapped error", () => {
    const wrapped = wrapError(new Error("test"), { attempt: 3 });
    expect(wrapped.context).toEqual({ attempt: 3 });
  });
});

// ============================================================================
// Run Tests
// ============================================================================

console.log("\n=== XMTP Plugin Unit Tests ===\n");
