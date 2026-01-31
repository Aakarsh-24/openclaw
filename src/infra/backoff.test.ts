import { describe, expect, it, vi } from "vitest";

import { computeBackoff, sleepWithAbort } from "./backoff.js";

describe("computeBackoff", () => {
  const policy = {
    initialMs: 1000,
    maxMs: 10000,
    factor: 2,
    jitter: 0, // Disable jitter for deterministic tests unless specified
  };

  it("returns initialMs for the first attempt (attempt 1)", () => {
    // attempt 1 => factor^(1-1) = factor^0 = 1
    // 1000 * 1 = 1000
    expect(computeBackoff(policy, 1)).toBe(1000);
  });

  it("returns calculated backoff for subsequent attempts", () => {
    // attempt 2 => 1000 * 2^1 = 2000
    expect(computeBackoff(policy, 2)).toBe(2000);
    // attempt 3 => 1000 * 2^2 = 4000
    expect(computeBackoff(policy, 3)).toBe(4000);
  });

  it("caps the backoff at maxMs", () => {
    // attempt 10 => 1000 * 2^9 = 512000 > 10000
    expect(computeBackoff(policy, 10)).toBe(10000);
  });

  it("treats attempt 0 or negative as attempt 1", () => {
    expect(computeBackoff(policy, 0)).toBe(1000);
    expect(computeBackoff(policy, -1)).toBe(1000);
  });

  it("applies jitter", () => {
    const jitterPolicy = { ...policy, jitter: 0.5 }; // 50% jitter
    // Base for attempt 2 is 2000.
    // jitter = 2000 * 0.5 * Math.random() => [0, 1000]
    // result = 2000 + [0, 1000] => [2000, 3000]

    // We run it multiple times to ensure we get variance
    const results = new Set();
    for (let i = 0; i < 50; i++) {
      const val = computeBackoff(jitterPolicy, 2);
      results.add(val);
      expect(val).toBeGreaterThanOrEqual(2000);
      expect(val).toBeLessThanOrEqual(3000);
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

describe("sleepWithAbort", () => {
  it("resolves after the specified duration", async () => {
    vi.useFakeTimers();
    const sleepPromise = sleepWithAbort(1000);

    // Should not resolve yet
    vi.advanceTimersByTime(500);

    // Advance remaining time
    vi.advanceTimersByTime(500);
    await expect(sleepPromise).resolves.toBeUndefined();
    vi.useRealTimers();
  });

  it("rejects immediately if abort signal is triggered", async () => {
    const controller = new AbortController();
    const sleepPromise = sleepWithAbort(5000, controller.signal);

    controller.abort();

    await expect(sleepPromise).rejects.toThrow("aborted");
  });

  it("rejects immediately if abort signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const sleepPromise = sleepWithAbort(5000, controller.signal);
    await expect(sleepPromise).rejects.toThrow("aborted");
  });

  it("resolves immediately for 0 or negative ms", async () => {
    await expect(sleepWithAbort(0)).resolves.toBeUndefined();
    await expect(sleepWithAbort(-100)).resolves.toBeUndefined();
  });
});
