/**
 * Tests for Multi-Account Module
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AccountManager } from "./account-manager.js";
import { RateLimitTracker } from "./rate-limit-tracker.js";

const mockAuthStore = {
  profiles: {
    "google-antigravity:user1@gmail.com": {
      type: "oauth",
      provider: "google-antigravity",
      email: "user1@gmail.com",
      access: "token1",
      refresh: "refresh1",
      expires: Date.now() + 3600_000,
      projectId: "project1",
    },
    "google-antigravity:user2@gmail.com": {
      type: "oauth",
      provider: "google-antigravity",
      email: "user2@gmail.com",
      access: "token2",
      refresh: "refresh2",
      expires: Date.now() + 3600_000,
      projectId: "project2",
    },
    "google-antigravity:user3@gmail.com": {
      type: "oauth",
      provider: "google-antigravity",
      email: "user3@gmail.com",
      access: "token3",
      refresh: "refresh3",
      expires: Date.now() + 3600_000,
      projectId: "project3",
    },
  },
};

describe("RateLimitTracker", () => {
  it("initially not rate limited", () => {
    const tracker = new RateLimitTracker();
    expect(tracker.isRateLimited("p1", "m1")).toBe(false);
  });

  it("marks rate limited", () => {
    const tracker = new RateLimitTracker();
    tracker.markRateLimited("p1", "m1", 5000);
    expect(tracker.isRateLimited("p1", "m1")).toBe(true);
  });

  it("clears rate limit", () => {
    const tracker = new RateLimitTracker();
    tracker.markRateLimited("p1", "m1", 5000);
    tracker.clearRateLimit("p1", "m1");
    expect(tracker.isRateLimited("p1", "m1")).toBe(false);
  });

  it("checks all rate limited", () => {
    const tracker = new RateLimitTracker();
    const profiles = ["p1", "p2", "p3"];
    
    expect(tracker.areAllRateLimited(profiles, "m1")).toBe(false);
    
    tracker.markRateLimited("p1", "m1", 5000);
    tracker.markRateLimited("p2", "m1", 5000);
    tracker.markRateLimited("p3", "m1", 5000);
    
    expect(tracker.areAllRateLimited(profiles, "m1")).toBe(true);
  });
});

describe("AccountManager", () => {
  let manager: AccountManager;

  beforeEach(async () => {
    manager = new AccountManager({ provider: "google-antigravity" });
    await manager.initialize(mockAuthStore);
  });

  it("initializes with auth store", () => {
    expect(manager.getAccountCount()).toBe(3);
  });

  it("selects account", () => {
    const { account, waitMs } = manager.selectAccount("claude-opus-4-5");
    expect(account).not.toBeNull();
    expect(waitMs).toBe(0);
  });

  it("handles rate limit failover", () => {
    const { account: first } = manager.selectAccount("m1");
    manager.markRateLimited(first!.profileId, "m1", 60_000);

    const { account: second } = manager.selectAccount("m1");
    expect(second!.profileId).not.toBe(first!.profileId);
  });

  it("returns wait time when all limited", () => {
    for (const acc of manager.getAllAccounts()) {
      manager.markRateLimited(acc.profileId, "m1", 30_000);
    }

    expect(manager.isAllRateLimited("m1")).toBe(true);

    const { account, waitMs } = manager.selectAccount("m1");
    expect(account).toBeNull();
    expect(waitMs).toBeGreaterThan(0);
  });

  it("updates health on success", () => {
    const { account } = manager.selectAccount("m1");
    const before = manager.healthScorer.getScore(account!.profileId);
    manager.notifySuccess(account!.profileId, "m1");
    const after = manager.healthScorer.getScore(account!.profileId);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("marks invalid accounts", () => {
    const profiles = manager.getProfilesForProvider();
    const first = profiles[0];
    manager.markInvalid(first, "Token revoked");
    
    const updated = manager.getProfilesForProvider();
    expect(updated).not.toContain(first);
  });

  it("sticky strategy keeps same account", async () => {
    const stickyManager = new AccountManager({
      provider: "google-antigravity",
      strategy: "sticky",
    });
    await stickyManager.initialize(mockAuthStore);

    const { account: a1 } = stickyManager.selectAccount("m1");
    const { account: a2 } = stickyManager.selectAccount("m1");
    expect(a1!.profileId).toBe(a2!.profileId);
  });

  it("round-robin cycles accounts", async () => {
    const rrManager = new AccountManager({
      provider: "google-antigravity",
      strategy: "round-robin",
    });
    await rrManager.initialize(mockAuthStore);

    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const { account } = rrManager.selectAccount("m1");
      seen.add(account!.profileId);
    }
    expect(seen.size).toBe(3);
  });
});
