import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { trySetupCompletion } from "../scripts/postinstall.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-postinstall-"));
}

describe("postinstall completion setup", () => {
  it("runs the completion installer when present", () => {
    const repo = makeTempDir();
    const home = makeTempDir();

    // fake openclaw.mjs that responds to the completion --install --yes invocation
    const bin = path.join(repo, "openclaw.mjs");
    const script = `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const home = process.env.HOME || (await import('node:os')).homedir();
if (args[0] === 'completion' && args.includes('--install') && args.includes('--yes')) {
  const marker = path.join(home, '.openclaw_completion_installed');
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, 'ok', 'utf-8');
  process.exit(0);
}
process.exit(0);
`;
    fs.writeFileSync(bin, script, { mode: 0o755 });

    // create dist entry to satisfy the check
    const distDir = path.join(repo, "dist");
    fs.mkdirSync(distDir);
    fs.writeFileSync(path.join(distDir, "index.js"), "// stub", "utf-8");

    const prevHome = process.env.HOME;
    try {
      process.env.HOME = home;
      trySetupCompletion(repo);
      const marker = path.join(home, '.openclaw_completion_installed');
      expect(fs.existsSync(marker)).toBe(true);
    } finally {
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });

  it("respects OPENCLAW_SKIP_COMPLETION_SETUP and CI", () => {
    const repo = makeTempDir();
    const home = makeTempDir();

    const bin = path.join(repo, "openclaw.mjs");
    const script = `#!/usr/bin/env node
process.exit(0);
`;
    fs.writeFileSync(bin, script, { mode: 0o755 });
    fs.mkdirSync(path.join(repo, "dist"));
    fs.writeFileSync(path.join(repo, "dist", "index.js"), "// stub", "utf-8");

    const prevHome = process.env.HOME;
    const prevSkip = process.env.OPENCLAW_SKIP_COMPLETION_SETUP;
    const prevCI = process.env.CI;
    try {
      process.env.HOME = home;
      process.env.OPENCLAW_SKIP_COMPLETION_SETUP = "1";
      trySetupCompletion(repo);
      // nothing should be created
      expect(fs.readdirSync(home).length).toBe(0);

      process.env.OPENCLAW_SKIP_COMPLETION_SETUP = "0";
      process.env.CI = "1";
      trySetupCompletion(repo);
      expect(fs.readdirSync(home).length).toBe(0);
    } finally {
      if (prevHome === undefined) delete process.env.HOME;
      else process.env.HOME = prevHome;
      if (prevSkip === undefined) delete process.env.OPENCLAW_SKIP_COMPLETION_SETUP;
      else process.env.OPENCLAW_SKIP_COMPLETION_SETUP = prevSkip;
      if (prevCI === undefined) delete process.env.CI;
      else process.env.CI = prevCI;

      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
