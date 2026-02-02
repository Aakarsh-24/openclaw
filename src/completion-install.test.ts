import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { installCompletion, uninstallCompletion } from "../src/cli/completion-cli.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-completion-"));
}

describe("completion install/uninstall", () => {
  it("installs and uninstalls into a bash profile and creates backups", async () => {
    const home = makeTempDir();
    const prevHome = process.env.HOME;
    try {
      process.env.HOME = home;
      const profile = path.join(home, ".bashrc");
      fs.mkdirSync(path.dirname(profile), { recursive: true });
      fs.writeFileSync(profile, "# original\n", "utf-8");

      await installCompletion("bash", true, "openclaw-test");
      const content = fs.readFileSync(profile, "utf-8");
      expect(content).toContain("# OpenClaw Completion");
      // Backup should exist
      const bak = fs.readdirSync(path.dirname(profile)).find((f) => f.includes(".openclaw.bak"));
      expect(bak).toBeTruthy();

      await uninstallCompletion("bash", "openclaw-test");
      const after = fs.readFileSync(profile, "utf-8");
      expect(after).not.toContain("# OpenClaw Completion");
      // A backup with uninstall in name should exist
      const uninstallBak = fs.readdirSync(path.dirname(profile)).find((f) => f.includes(".openclaw.uninstall.bak"));
      expect(uninstallBak).toBeTruthy();
    } finally {
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
