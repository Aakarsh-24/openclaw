import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mariozechner/pi-coding-agent", () => ({
  discoverAuthStorage: () => ({ profiles: {} }),
  discoverModels: () => ({
    find: (provider: string, modelId: string) => {
      if (provider === "ollama" && modelId === "test-model") {
        return {
          id: "test-model",
          name: "test-model",
          provider: "ollama",
          api: "openai-completions",
          reasoning: false,
          input: ["text"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 8192,
          maxTokens: 4096,
        };
      }
      return null;
    },
  }),
}));

vi.mock("../agent-paths.js", () => ({
  resolveClawdbotAgentDir: () => "/tmp/test-agent",
}));

vi.mock("../model-compat.js", () => ({
  normalizeModelCompat: <T>(model: T) => model,
}));

import { buildInlineProviderModels, resolveModel } from "./model.js";

const makeModel = (id: string, overrides?: { contextWindow?: number; maxTokens?: number }) => ({
  id,
  name: id,
  reasoning: false,
  input: ["text"] as const,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: overrides?.contextWindow ?? 1,
  maxTokens: overrides?.maxTokens ?? 1,
});

describe("buildInlineProviderModels", () => {
  it("attaches provider ids to inline models", () => {
    const providers = {
      " alpha ": { models: [makeModel("alpha-model")] },
      beta: { models: [makeModel("beta-model")] },
    };

    const result = buildInlineProviderModels(providers);

    expect(result).toEqual([
      { ...makeModel("alpha-model"), provider: "alpha" },
      { ...makeModel("beta-model"), provider: "beta" },
    ]);
  });
});

describe("resolveModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses registry model when no config override exists", () => {
    const result = resolveModel("ollama", "test-model");

    expect(result.model).toBeDefined();
    expect(result.model?.contextWindow).toBe(8192);
    expect(result.model?.maxTokens).toBe(4096);
  });

  it("overrides registry contextWindow with valid config value", () => {
    const cfg = {
      models: {
        providers: {
          ollama: {
            models: [makeModel("test-model", { contextWindow: 131072, maxTokens: 32000 })],
          },
        },
      },
    };

    const result = resolveModel("ollama", "test-model", undefined, cfg);

    expect(result.model).toBeDefined();
    expect(result.model?.contextWindow).toBe(131072);
    expect(result.model?.maxTokens).toBe(32000);
  });

  it("ignores config contextWindow of 0", () => {
    const cfg = {
      models: {
        providers: {
          ollama: {
            models: [makeModel("test-model", { contextWindow: 0 })],
          },
        },
      },
    };

    const result = resolveModel("ollama", "test-model", undefined, cfg);

    expect(result.model?.contextWindow).toBe(8192); // registry value
  });

  it("ignores config contextWindow of negative number", () => {
    const cfg = {
      models: {
        providers: {
          ollama: {
            models: [makeModel("test-model", { contextWindow: -1 })],
          },
        },
      },
    };

    const result = resolveModel("ollama", "test-model", undefined, cfg);

    expect(result.model?.contextWindow).toBe(8192); // registry value
  });

  it("uses config model when not in registry", () => {
    const cfg = {
      models: {
        providers: {
          ollama: {
            models: [makeModel("not-in-registry", { contextWindow: 65536 })],
          },
        },
      },
    };

    const result = resolveModel("ollama", "not-in-registry", undefined, cfg);

    expect(result.model).toBeDefined();
    expect(result.model?.contextWindow).toBe(65536);
  });

  it("returns error when model not in registry and no config", () => {
    const result = resolveModel("ollama", "unknown-model");

    expect(result.error).toContain("Unknown model");
    expect(result.model).toBeUndefined();
  });
});
