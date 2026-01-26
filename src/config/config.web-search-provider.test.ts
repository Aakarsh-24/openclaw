import { describe, expect, it } from "vitest";

import { validateConfigObject } from "./config.js";

describe("web search provider config", () => {
  it("accepts perplexity provider and config", () => {
    const res = validateConfigObject({
      tools: {
        web: {
          search: {
            enabled: true,
            provider: "perplexity",
            perplexity: {
              apiKey: "test-key",
              baseUrl: "https://api.perplexity.ai",
              model: "perplexity/sonar-pro",
            },
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts parallel provider and config", () => {
    const res = validateConfigObject({
      tools: {
        web: {
          search: {
            enabled: true,
            provider: "parallel",
            parallel: {
              apiKey: "test-parallel-key",
              baseUrl: "https://api.parallel.ai",
            },
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });

  it("accepts parallel extract config for fetch", () => {
    const res = validateConfigObject({
      tools: {
        web: {
          fetch: {
            enabled: true,
            parallel: {
              enabled: true,
              apiKey: "test-parallel-key",
              baseUrl: "https://api.parallel.ai",
              timeoutSeconds: 30,
            },
          },
        },
      },
    });

    expect(res.ok).toBe(true);
  });
});
