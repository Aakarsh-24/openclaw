import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { __testing, acquireSessionWriteLock } from "./session-write-lock.js";

describe.sequential("acquireSessionWriteLock", () => {
  let testRoot: string;
  // Track all locks acquired during a test for explicit cleanup
  let acquiredLocks: Array<{ release: () => Promise<void> }>;

  beforeEach(async () => {
    testRoot = await fs.mkdtemp(path.join(os.tmpdir(), "moltbot-lock-"));
    acquiredLocks = [];
  });

  afterEach(async () => {
    // Explicitly release any locks that weren't already released
    for (const lock of acquiredLocks) {
      try {
        await lock.release();
      } catch {
        // Lock may already be released by signal handler - ignore
      }
    }
    acquiredLocks = [];

    // Clean up test directory
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  async function acquireLock(sessionFile: string, timeoutMs = 500, staleMs?: number) {
    const lock = await acquireSessionWriteLock({ sessionFile, timeoutMs, staleMs });
    acquiredLocks.push(lock);
    return lock;
  }

  function markLockAsReleased(lock: { release: () => Promise<void> }) {
    const idx = acquiredLocks.indexOf(lock);
    if (idx !== -1) {
      acquiredLocks.splice(idx, 1);
    }
  }

  it("reuses locks across symlinked session paths", async () => {
    if (process.platform === "win32") {
      expect(true).toBe(true);
      return;
    }

    const realDir = path.join(testRoot, "real");
    const linkDir = path.join(testRoot, "link");
    await fs.mkdir(realDir, { recursive: true });
    await fs.symlink(realDir, linkDir);

    const sessionReal = path.join(realDir, "sessions.json");
    const sessionLink = path.join(linkDir, "sessions.json");

    const lockA = await acquireLock(sessionReal);
    const lockB = await acquireLock(sessionLink);

    await lockB.release();
    markLockAsReleased(lockB);
    await lockA.release();
    markLockAsReleased(lockA);
  });

  it("keeps the lock file until the last release", async () => {
    const sessionFile = path.join(testRoot, "sessions.json");
    const lockPath = `${sessionFile}.lock`;

    const lockA = await acquireLock(sessionFile);
    const lockB = await acquireLock(sessionFile);

    await expect(fs.access(lockPath)).resolves.toBeUndefined();
    await lockA.release();
    markLockAsReleased(lockA);
    await expect(fs.access(lockPath)).resolves.toBeUndefined();
    await lockB.release();
    markLockAsReleased(lockB);
    await expect(fs.access(lockPath)).rejects.toThrow();
  });

  it("reclaims stale lock files", async () => {
    const sessionFile = path.join(testRoot, "sessions.json");
    const lockPath = `${sessionFile}.lock`;
    await fs.writeFile(
      lockPath,
      JSON.stringify({ pid: 123456, createdAt: new Date(Date.now() - 60_000).toISOString() }),
      "utf8",
    );

    const lock = await acquireLock(sessionFile, 500, 10);
    const raw = await fs.readFile(lockPath, "utf8");
    const payload = JSON.parse(raw) as { pid: number };

    expect(payload.pid).toBe(process.pid);
    await lock.release();
    markLockAsReleased(lock);
  });

  it("removes held locks on termination signals", async () => {
    const signals = ["SIGINT", "SIGTERM", "SIGQUIT", "SIGABRT"] as const;
    for (const signal of signals) {
      const signalRoot = await fs.mkdtemp(path.join(os.tmpdir(), "moltbot-lock-cleanup-"));
      try {
        const sessionFile = path.join(signalRoot, "sessions.json");
        const lockPath = `${sessionFile}.lock`;

        // Acquire lock directly (not through helper) since signal handler will release it
        const lock = await acquireSessionWriteLock({ sessionFile, timeoutMs: 500 });

        const keepAlive = () => {};
        if (signal === "SIGINT") {
          process.on(signal, keepAlive);
        }

        // This synchronously releases all locks and clears HELD_LOCKS
        __testing.handleTerminationSignal(signal);

        // Lock file should be deleted by signal handler
        await expect(fs.stat(lockPath)).rejects.toThrow();

        // Don't call lock.release() - handle is already closed by signal handler
        // Calling release() would cause EBADF

        if (signal === "SIGINT") {
          process.off(signal, keepAlive);
        }
      } finally {
        await fs.rm(signalRoot, { recursive: true, force: true });
      }
    }
  });

  it("registers cleanup for SIGQUIT and SIGABRT", () => {
    expect(__testing.cleanupSignals).toContain("SIGQUIT");
    expect(__testing.cleanupSignals).toContain("SIGABRT");
  });

  it("cleans up locks on SIGINT without removing other handlers", async () => {
    const originalKill = process.kill.bind(process) as typeof process.kill;
    const killCalls: Array<NodeJS.Signals | undefined> = [];
    let otherHandlerCalled = false;

    process.kill = ((pid: number, signal?: NodeJS.Signals) => {
      killCalls.push(signal);
      return true;
    }) as typeof process.kill;

    const otherHandler = () => {
      otherHandlerCalled = true;
    };

    process.on("SIGINT", otherHandler);

    try {
      const sessionFile = path.join(testRoot, "sessions.json");
      const lockPath = `${sessionFile}.lock`;

      // Acquire lock directly - signal emission will release it synchronously
      await acquireSessionWriteLock({ sessionFile, timeoutMs: 500 });

      // This triggers the cleanup handler which calls releaseAllLocksSync
      process.emit("SIGINT");

      // Lock should be cleaned up by signal handler
      await expect(fs.access(lockPath)).rejects.toThrow();
      expect(otherHandlerCalled).toBe(true);
      expect(killCalls).toEqual([]);

      // Don't try to release - handle already closed
    } finally {
      process.off("SIGINT", otherHandler);
      process.kill = originalKill;
    }
  });

  it("cleans up locks on exit", async () => {
    const sessionFile = path.join(testRoot, "sessions.json");
    const lockPath = `${sessionFile}.lock`;

    // Acquire lock directly - exit event will release it synchronously
    await acquireSessionWriteLock({ sessionFile, timeoutMs: 500 });

    // This triggers the cleanup handler which calls releaseAllLocksSync
    process.emit("exit", 0);

    // Lock should be cleaned up by exit handler
    await expect(fs.access(lockPath)).rejects.toThrow();

    // Don't try to release - handle already closed
  });

  it("keeps other signal listeners registered", () => {
    const keepAlive = () => {};
    process.on("SIGINT", keepAlive);

    __testing.handleTerminationSignal("SIGINT");

    expect(process.listeners("SIGINT")).toContain(keepAlive);
    process.off("SIGINT", keepAlive);
  });
});
