import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveImplicitProviders } from "./models-config.providers.js";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Ollama provider", () => {
  const previousOllamaKey = process.env.OLLAMA_API_KEY;

  beforeEach(() => {
    // Clear OLLAMA_API_KEY to test the "no key" scenario
    delete process.env.OLLAMA_API_KEY;
  });

  afterEach(() => {
    // Restore original env var
    if (previousOllamaKey === undefined) {
      delete process.env.OLLAMA_API_KEY;
    } else {
      process.env.OLLAMA_API_KEY = previousOllamaKey;
    }
  });

  it("should not include ollama when no API key is configured", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "clawd-test-"));
    const providers = await resolveImplicitProviders({ agentDir });

    // Ollama requires explicit configuration via OLLAMA_API_KEY env var or profile
    expect(providers?.ollama).toBeUndefined();
  });
});
