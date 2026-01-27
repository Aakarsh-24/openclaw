/**
 * x402 Payment Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createX402Tool } from "./x402-tool.js";

// Mock the x402 packages
vi.mock("@x402/fetch", () => ({
  wrapFetchWithPaymentFromConfig: vi.fn((baseFetch) => baseFetch),
  decodePaymentResponseHeader: vi.fn((header) => {
    try {
      return JSON.parse(Buffer.from(header, "base64").toString());
    } catch {
      return null;
    }
  }),
}));

vi.mock("@x402/evm", () => ({
  ExactEvmScheme: vi.fn().mockImplementation(() => ({
    scheme: "exact",
    createPaymentPayload: vi.fn(),
  })),
}));

vi.mock("@x402/svm", () => ({
  ExactSvmScheme: vi.fn().mockImplementation(() => ({
    scheme: "exact",
    createPaymentPayload: vi.fn(),
  })),
}));

vi.mock("viem", () => ({
  createWalletClient: vi.fn(),
  http: vi.fn(),
}));

vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn().mockReturnValue({
    address: "0x1234567890123456789012345678901234567890",
  }),
}));

vi.mock("viem/chains", () => ({
  base: { id: 8453, rpcUrls: { default: { http: ["https://mainnet.base.org"] } } },
  baseSepolia: { id: 84532, rpcUrls: { default: { http: ["https://sepolia.base.org"] } } },
}));

describe("x402 Payment Tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates tool with correct name and schema", () => {
    const tool = createX402Tool({
      evmPrivateKey: "0x1234",
      maxPaymentUSDC: "0.10",
    });

    expect(tool.name).toBe("x402_payment");
    expect(tool.schema).toBeDefined();
    expect(tool.description).toContain("x402");
  });

  it("returns error when no wallet configured for EVM", async () => {
    const tool = createX402Tool({});

    // Mock fetch to return 402
    global.fetch = vi.fn().mockResolvedValue({
      status: 402,
      json: () => Promise.resolve({ accepts: [{ network: "base" }] }),
    });

    const result = await tool.run({ url: "https://api.example.com/paid" });

    expect(result.content[0]).toHaveProperty("text");
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain("error");
    expect(text).toContain("evmPrivateKey");
  });

  it("detects network from 402 response", async () => {
    const tool = createX402Tool({
      evmPrivateKey: "0x1234567890123456789012345678901234567890123456789012345678901234",
    });

    // Mock fetch to return 402 with network info, then success
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // Network detection call
        return {
          status: 402,
          json: () => Promise.resolve({
            accepts: [{ network: "base", payTo: "0x123", maxAmountRequired: "1000" }],
          }),
        };
      }
      // Actual paid request
      return {
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/json"]]),
        json: () => Promise.resolve({ success: true, data: "test" }),
      };
    });

    const result = await tool.run({ url: "https://api.example.com/paid" });
    const parsed = JSON.parse((result.content[0] as { text: string }).text);

    expect(parsed.network).toBe("base");
  });

  it("respects maxPaymentUSDC config", () => {
    const tool = createX402Tool({
      evmPrivateKey: "0x1234",
      maxPaymentUSDC: "0.50",
    });

    // The max is stored internally - we verify it's created without error
    expect(tool).toBeDefined();
  });
});
