import { execFile as execFileCb, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { parseGitStatusPorcelainV2 } from "./porcelain-v2.js";

const execFile = promisify(execFileCb);

const hasGit = (() => {
  const res = spawnSync("git", ["--version"], { stdio: "ignore" });
  return res.status === 0;
})();

describe("parseGitStatusPorcelainV2 (real git)", () => {
  it.runIf(hasGit)("parses rename + modified + untracked in a temp repo", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "openclaw-git-porcelain-"));

    const run = async (args: string[]) => {
      const { stdout } = await execFile("git", args, { cwd: dir, encoding: "utf8" });
      return stdout;
    };

    try {
      await run(["init"]);
      // Ensure commits work regardless of global git config.
      await run(["config", "user.email", "test@example.com"]);
      await run(["config", "user.name", "OpenClaw Test"]);

      // Start with a tracked file containing spaces.
      const oldName = "old name.txt";
      const newName = "new name.txt";
      await writeFile(path.join(dir, oldName), "hello\n", "utf8");
      await run(["add", "--", oldName]);
      await run(["commit", "-m", "initial"]);

      // Rename (produces a porcelain v2 '2' record).
      await run(["mv", "--", oldName, newName]);

      // Modify the renamed file (can still appear as rename).
      await writeFile(path.join(dir, newName), "hello world\n", "utf8");

      // Add an untracked file with spaces.
      const untracked = "untracked file.txt";
      await writeFile(path.join(dir, untracked), "u\n", "utf8");

      const stdout = await run([
        "-c",
        "core.quotepath=true",
        "status",
        "--porcelain=v2",
        "--branch",
      ]);
      const parsed = parseGitStatusPorcelainV2(stdout);

      expect(typeof parsed.branch.head).toBe("string");

      const rename = parsed.entries.find((e) => e.code === "2");
      expect(rename?.path).toBe(newName);
      expect(rename?.origPath).toBe(oldName);

      const q = parsed.entries.find((e) => e.code === "?" && e.path === untracked);
      expect(q).toBeTruthy();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
