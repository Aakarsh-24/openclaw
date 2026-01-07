import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ensureSandboxWorkspaceForSession } from "./sandbox.js";

async function withTempHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  const base = await fs.mkdtemp(join(tmpdir(), "clawdbot-sandbox-"));
  const previousHome = process.env.HOME;
  process.env.HOME = base;
  try {
    return await fn(base);
  } finally {
    process.env.HOME = previousHome;
    await fs.rm(base, { recursive: true, force: true });
  }
}

describe("sandbox config", () => {
  it("uses per-agent sandbox overrides from routing.agents", async () => {
    await withTempHome(async (home) => {
      const agentWorkspace = join(home, "clawd");
      const perAgentRoot = join(home, "alpha-sandboxes");
      const cfg = {
        agent: {
          workspace: agentWorkspace,
          sandbox: {
            mode: "off" as const,
            workspaceRoot: join(home, "global-sandboxes"),
          },
        },
        routing: {
          agents: {
            alpha: {
              sandbox: {
                mode: "non-main" as const,
                perSession: false,
                workspaceRoot: perAgentRoot,
              },
            },
          },
        },
      };

      const sandbox = await ensureSandboxWorkspaceForSession({
        config: cfg,
        sessionKey: "agent:alpha:main",
        workspaceDir: agentWorkspace,
      });

      expect(sandbox).not.toBeNull();
      if (!sandbox) {
        throw new Error("Expected sandbox to be set");
      }
      expect(sandbox.workspaceDir).toBe(perAgentRoot);
    });
  });
});
