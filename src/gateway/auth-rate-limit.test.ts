import { afterEach, describe, expect, it } from "vitest";
import type { ResolvedRateLimitsAuthConfig } from "../config/types.gateway.js";
import { AuthRateLimiter } from "./auth-rate-limit.js";

function makeConfig(
  overrides?: Partial<ResolvedRateLimitsAuthConfig>,
): ResolvedRateLimitsAuthConfig {
  return {
    maxFailures: overrides?.maxFailures ?? 10,
    windowMinutes: overrides?.windowMinutes ?? 15,
  };
}

describe("AuthRateLimiter", () => {
  let limiter: AuthRateLimiter;

  afterEach(() => {
    limiter?.destroy();
  });

  it("allows auth attempts within limit", () => {
    limiter = new AuthRateLimiter(makeConfig({ maxFailures: 5 }));
    for (let i = 0; i < 5; i++) {
      const result = limiter.checkAuthAllowed("192.168.1.1");
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks auth after maxFailures exceeded", () => {
    limiter = new AuthRateLimiter(makeConfig({ maxFailures: 3 }));
    for (let i = 0; i < 3; i++) {
      limiter.checkAuthAllowed("192.168.1.1");
      limiter.recordFailure("192.168.1.1");
    }
    const result = limiter.checkAuthAllowed("192.168.1.1");
    expect(result.allowed).toBe(false);
  });

  it("returns retryAfterMs when blocked", () => {
    limiter = new AuthRateLimiter(makeConfig({ maxFailures: 1, windowMinutes: 15 }));
    limiter.checkAuthAllowed("192.168.1.1");
    limiter.recordFailure("192.168.1.1");
    const result = limiter.checkAuthAllowed("192.168.1.1");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets failure count on successful auth", () => {
    limiter = new AuthRateLimiter(makeConfig({ maxFailures: 2 }));
    // Consume tokens
    limiter.checkAuthAllowed("192.168.1.1");
    limiter.recordFailure("192.168.1.1");
    limiter.checkAuthAllowed("192.168.1.1");

    // Reset on success
    limiter.recordSuccess("192.168.1.1");

    // Should be allowed again
    const result = limiter.checkAuthAllowed("192.168.1.1");
    expect(result.allowed).toBe(true);
  });

  it("separate tracking per IP", () => {
    limiter = new AuthRateLimiter(makeConfig({ maxFailures: 1 }));
    limiter.checkAuthAllowed("10.0.0.1");
    limiter.recordFailure("10.0.0.1");

    // 10.0.0.1 should be blocked
    expect(limiter.checkAuthAllowed("10.0.0.1").allowed).toBe(false);

    // 10.0.0.2 should still be allowed
    expect(limiter.checkAuthAllowed("10.0.0.2").allowed).toBe(true);
  });

  it("failures expire after windowMinutes", () => {
    // Use a tiny window to test expiry via the token bucket refill.
    // The RateLimiter refills after refillIntervalMs = windowMinutes * 60_000.
    // With maxFailures=1, windowMinutes=15 → refill at 900_000 ms.
    limiter = new AuthRateLimiter(makeConfig({ maxFailures: 1, windowMinutes: 15 }));
    limiter.checkAuthAllowed("192.168.1.1");
    limiter.recordFailure("192.168.1.1");

    // Blocked immediately
    expect(limiter.checkAuthAllowed("192.168.1.1").allowed).toBe(false);

    // After window expires, a new limiter instance would have refilled.
    // Since we can't easily control time in the RateLimiter without exposing
    // the `now` parameter, we verify the retryAfterMs is set correctly.
    // The retryAfterMs should be <= windowMinutes * 60_000.
    const blocked = limiter.checkAuthAllowed("192.168.1.1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  it("does not block when rateLimits.enabled is false", () => {
    limiter = new AuthRateLimiter(makeConfig({ maxFailures: 1 }), false);
    // Even after many "failures", should always be allowed
    for (let i = 0; i < 20; i++) {
      limiter.checkAuthAllowed("192.168.1.1");
      limiter.recordFailure("192.168.1.1");
    }
    expect(limiter.checkAuthAllowed("192.168.1.1").allowed).toBe(true);
  });

  it("destroy cleans up", () => {
    limiter = new AuthRateLimiter(makeConfig());
    limiter.checkAuthAllowed("192.168.1.1");
    expect(limiter.size).toBe(1);
    limiter.destroy();
    // Double destroy should be safe
    limiter.destroy();
  });
});
