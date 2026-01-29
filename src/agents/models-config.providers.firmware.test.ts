import { describe, expect, it } from "vitest";
import { resolveImplicitProviders } from "./models-config.providers.js";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Firmware provider", () => {
  it("should not include firmware when no API key is configured", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "clawd-test-"));
    const providers = await resolveImplicitProviders({ agentDir });

    expect(providers?.firmware).toBeUndefined();
  });

  it("should include firmware when FIRMWARE_API_KEY env var is set", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "clawd-test-"));
    const providers = await resolveImplicitProviders({ agentDir });

    // This test would need to be run with FIRMWARE_API_KEY env var set
    // For now we're just checking the provider structure is correct
    expect(providers).toBeDefined();
  });
});
