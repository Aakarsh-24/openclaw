import { describe, expect, it, vi } from "vitest";
import { startGatewayServer } from "../src/gateway/server.js";
import { getDeterministicFreePortBlock } from "../src/test-utils/ports.js";

async function getFreeGatewayPort(): Promise<number> {
  return await getDeterministicFreePortBlock();
}

describe("gateway http security headers", () => {
  it("adds baseline security headers on Control UI responses", async () => {
    const token = "test-token-security-headers";
    vi.stubEnv("OPENCLAW_GATEWAY_TOKEN", token);
    vi.stubEnv("OPENCLAW_SKIP_CHANNELS", "1");
    vi.stubEnv("OPENCLAW_SKIP_CRON", "1");
    vi.stubEnv("OPENCLAW_SKIP_CANVAS_HOST", "1");

    const port = await getFreeGatewayPort();
    const server = await startGatewayServer(port, {
      bind: "loopback",
      auth: { mode: "token", token },
      controlUiEnabled: true,
    });

    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
      const permissions = res.headers.get("permissions-policy") ?? "";
      expect(permissions).toContain("camera=()");
      expect(permissions).toContain("microphone=()");
      expect(permissions).toContain("geolocation=()");
    } finally {
      await server.close({ reason: "security headers test complete" });
      vi.unstubAllEnvs();
    }
  }, 60_000);
});
