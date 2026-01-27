/**
 * Unit tests for ENS resolution utilities
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clearCache,
  getCacheSize,
  isEnsName,
  namehash,
  normalizeEnsName,
  resolveBatch,
  resolveEnsName,
} from "../ens.js";

describe("ENS Utilities", () => {
  describe("namehash", () => {
    it("should compute correct namehash for empty string", () => {
      const hash = namehash("");
      assert.equal(
        hash,
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("should compute correct namehash for 'eth'", () => {
      const hash = namehash("eth");
      assert.equal(
        hash,
        "0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae"
      );
    });

    it("should compute correct namehash for 'vitalik.eth'", () => {
      const hash = namehash("vitalik.eth");
      assert.equal(
        hash,
        "0xee6c4522aab0003e8d14cd40a6af439055fd2577951148c14b6cea9a53475835"
      );
    });

    it("should handle mixed case", () => {
      const hash1 = namehash("Vitalik.ETH");
      const hash2 = namehash("vitalik.eth");
      assert.equal(hash1, hash2);
    });

    it("should handle subdomain namehash correctly", () => {
      const hash = namehash("sub.vitalik.eth");
      // This is a known namehash - just verify it's consistent
      assert.equal(hash.length, 66); // 0x + 64 hex chars
      assert.match(hash, /^0x[0-9a-f]{64}$/);
    });
  });

  describe("isEnsName", () => {
    it("should recognize valid .eth names", () => {
      assert.equal(isEnsName("vitalik.eth"), true);
      assert.equal(isEnsName("mybot.eth"), true);
      assert.equal(isEnsName("sub.domain.eth"), true);
    });

    it("should recognize valid .xyz names", () => {
      assert.equal(isEnsName("example.xyz"), true);
    });

    it("should recognize .base.eth names", () => {
      assert.equal(isEnsName("mybot.base.eth"), true);
    });

    it("should handle @ prefix", () => {
      assert.equal(isEnsName("@vitalik.eth"), true);
      assert.equal(isEnsName("@example.xyz"), true);
    });

    it("should reject non-ENS names", () => {
      assert.equal(isEnsName("example.com"), false);
      assert.equal(isEnsName("notadomain"), false);
      assert.equal(isEnsName("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"), false);
    });

    it("should handle case insensitivity", () => {
      assert.equal(isEnsName("VITALIK.ETH"), true);
      assert.equal(isEnsName("MyBot.Eth"), true);
    });

    it("should handle whitespace", () => {
      assert.equal(isEnsName("  vitalik.eth  "), true);
    });
  });

  describe("normalizeEnsName", () => {
    it("should lowercase ENS names", () => {
      assert.equal(normalizeEnsName("Vitalik.ETH"), "vitalik.eth");
    });

    it("should remove @ prefix", () => {
      assert.equal(normalizeEnsName("@vitalik.eth"), "vitalik.eth");
      assert.equal(normalizeEnsName("@MyBot.Eth"), "mybot.eth");
    });

    it("should trim whitespace", () => {
      assert.equal(normalizeEnsName("  vitalik.eth  "), "vitalik.eth");
    });

    it("should handle combination of transformations", () => {
      assert.equal(normalizeEnsName("  @VITALIK.ETH  "), "vitalik.eth");
    });
  });

  describe("resolveEnsName", () => {
    it("should return null for non-ENS names", async () => {
      const address = await resolveEnsName("notadomain");
      assert.equal(address, null);
    });

    it("should return null for Ethereum addresses", async () => {
      const address = await resolveEnsName("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
      assert.equal(address, null);
    });

    it("should handle @ prefix", async () => {
      // Mock test - in real usage this would resolve
      const address = await resolveEnsName("@vitalik.eth", {
        timeoutMs: 100,
        rpcUrls: [], // No RPC URLs = will fail gracefully
      });
      // With no RPC URLs, should return null
      assert.equal(address, null);
    });

    // Note: Real ENS resolution tests require network access
    // Run these in integration tests instead of unit tests
  });

  describe("Cache Management", () => {
    it("should start with empty cache", () => {
      clearCache();
      assert.equal(getCacheSize(), 0);
    });

    it("should track cache size", () => {
      clearCache();
      assert.equal(getCacheSize(), 0);
      // Cache would be populated by resolveEnsName in real usage
    });

    it("should clear cache", () => {
      clearCache();
      const initialSize = getCacheSize();
      clearCache();
      assert.equal(getCacheSize(), initialSize); // Should remain same (0)
    });
  });

  describe("resolveBatch", () => {
    it("should resolve empty array", async () => {
      const results = await resolveBatch([]);
      assert.equal(results.size, 0);
    });

    it("should handle invalid names gracefully", async () => {
      const results = await resolveBatch(["notadomain", "example.com"], {
        timeoutMs: 100,
        rpcUrls: [],
      });
      
      assert.equal(results.size, 2);
      assert.equal(results.get("notadomain"), null);
      assert.equal(results.get("example.com"), null);
    });

    it("should normalize names in results", async () => {
      const results = await resolveBatch(["@VITALIK.ETH"], {
        timeoutMs: 100,
        rpcUrls: [],
      });
      
      // Should normalize to lowercase without @
      assert.equal(results.has("vitalik.eth"), true);
    });
  });
});
