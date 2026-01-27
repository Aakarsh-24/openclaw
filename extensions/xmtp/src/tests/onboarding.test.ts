/**
 * XMTP Onboarding Tests
 *
 * Unit tests for the onboarding wizard utilities.
 */

import { describe, expect, test } from "./test-helpers.js";
import { deriveAddress, generateWallet } from "../onboarding.js";

// ============================================================================
// Wallet Generation Tests
// ============================================================================

describe("generateWallet", () => {
  test("generates valid wallet with private key and address", () => {
    const wallet = generateWallet();
    
    // Private key should be 0x + 64 hex chars
    expect(wallet.privateKey.startsWith("0x")).toBe(true);
    expect(wallet.privateKey.length).toBe(66);
    expect(/^0x[a-f0-9]{64}$/i.test(wallet.privateKey)).toBe(true);
    
    // Address should be 0x + 40 hex chars
    expect(wallet.address.startsWith("0x")).toBe(true);
    expect(wallet.address.length).toBe(42);
    expect(/^0x[a-f0-9]{40}$/i.test(wallet.address)).toBe(true);
  });

  test("generates unique wallets on each call", () => {
    const wallet1 = generateWallet();
    const wallet2 = generateWallet();
    
    // Should be different
    expect(wallet1.privateKey !== wallet2.privateKey).toBe(true);
    expect(wallet1.address !== wallet2.address).toBe(true);
  });

  test("derived address is deterministic for same key", () => {
    const wallet = generateWallet();
    const address = deriveAddress(wallet.privateKey);
    
    expect(address).toBe(wallet.address);
  });
});

// ============================================================================
// Address Derivation Tests
// ============================================================================

describe("deriveAddress", () => {
  test("derives correct address from valid private key", () => {
    // Generate a wallet to test with
    const wallet = generateWallet();
    const derived = deriveAddress(wallet.privateKey);
    
    expect(derived).toBe(wallet.address);
  });

  test("returns null for invalid private key format", () => {
    // Missing 0x prefix
    expect(deriveAddress("1234567890123456789012345678901234567890123456789012345678901234")).toBe(null);
    
    // Wrong length
    expect(deriveAddress("0x1234")).toBe(null);
    expect(deriveAddress("0x123456789012345678901234567890123456789012345678901234567890123456")).toBe(null);
    
    // Empty string
    expect(deriveAddress("")).toBe(null);
    
    // Invalid characters
    expect(deriveAddress("0xZZZZ567890123456789012345678901234567890123456789012345678901234")).toBe(null);
  });

  test("returns null for null/undefined input", () => {
    expect(deriveAddress(null as unknown as string)).toBe(null);
    expect(deriveAddress(undefined as unknown as string)).toBe(null);
  });
});

// ============================================================================
// Test Runner
// ============================================================================

console.log("\n=== XMTP Onboarding Tests ===\n");
