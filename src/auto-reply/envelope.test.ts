import { describe, expect, it } from "vitest";

import { formatAgentEnvelope } from "./envelope.js";

describe("formatAgentEnvelope", () => {
  // Pattern matches human-readable timestamp with any timezone
  const timestampPattern =
    /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4} at \d{1,2}:\d{2} (AM|PM) \w+/;

  it("includes channel, from, ip, host, and timestamp", () => {
    const ts = Date.UTC(2025, 0, 2, 3, 4); // 2025-01-02T03:04:00Z
    const body = formatAgentEnvelope({
      channel: "WebChat",
      from: "user1",
      host: "mac-mini",
      ip: "10.0.0.5",
      timestamp: ts,
      body: "hello",
    });

    expect(body).toMatch(/^\[WebChat user1 mac-mini 10\.0\.0\.5/);
    expect(body).toMatch(timestampPattern);
    expect(body).toContain("2025");
    expect(body).toMatch(/\] hello$/);
  });

  it("formats timestamps in host timezone", () => {
    const ts = Date.UTC(2025, 0, 2, 3, 4); // 2025-01-02T03:04:00Z
    const body = formatAgentEnvelope({
      channel: "WebChat",
      timestamp: ts,
      body: "hello",
    });

    expect(body).toMatch(/^\[WebChat/);
    expect(body).toMatch(timestampPattern);
    expect(body).toMatch(/\] hello$/);
  });

  it("handles missing optional fields", () => {
    const body = formatAgentEnvelope({ channel: "Telegram", body: "hi" });
    expect(body).toBe("[Telegram] hi");
  });
});
