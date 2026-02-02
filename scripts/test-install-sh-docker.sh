#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as crypto from "node:crypto"; // added for hash verification

function env(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined ? undefined : v;
}

function envOr(name: string, fallback: string): string {
  const v = env(name);
  return v === undefined || v === "" ? fallback : v;
}

function run(cmd: string, args: string[], opts?: { cwd?: string; env?: NodeJS.ProcessEnv }): void {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: opts?.cwd,
    env: opts?.env ?? process.env,
  });
  if (res.error) throw res.error;
  if (res.status !== 0) process.exit(res.status ?? 1);
}

const ROOT_DIR = path.resolve(__dirname, "..");
const SMOKE_IMAGE = envOr(
  "OPENCLAW_INSTALL_SMOKE_IMAGE",
  envOr("CLAWDBOT_INSTALL_SMOKE_IMAGE", "openclaw-install-smoke:local"),
);
const NONROOT_IMAGE = envOr(
  "OPENCLAW_INSTALL_NONROOT_IMAGE",
  envOr("CLAWDBOT_INSTALL_NONROOT_IMAGE", "openclaw-install-nonroot:local"),
);
const INSTALL_URL = envOr("OPENCLAW_INSTALL_URL", envOr("CLAWDBOT_INSTALL_URL", "https://openclaw.bot/install.sh"));
const CLI_INSTALL_URL = envOr(
  "OPENCLAW_INSTALL_CLI_URL",
  envOr("CLAWDBOT_INSTALL_CLI_URL", "https://openclaw.bot/install-cli.sh"),
);
const CLI_INSTALL_SHA256 = envOr(
  "OPENCLAW_INSTALL_CLI_SHA256",
  envOr("CLAWDBOT_INSTALL_CLI_SHA256", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"), // dummy hash, replace with real
);
const SKIP_NONROOT = envOr("OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT", envOr("CLAWDBOT_INSTALL_SMOKE_SKIP_NONROOT", "0"));

const LATEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-install-smoke-"));
const LATEST_FILE = path.join(LATEST_DIR, "latest");

console.log(`==> Build smoke image (upgrade, root): ${SMOKE_IMAGE}`);
run("docker", [
  "build",
  "-t",
  SMOKE_IMAGE,
  "-f",
  path.join(ROOT_DIR, "scripts/docker/install-sh-smoke/Dockerfile"),
  path.join(ROOT_DIR, "scripts/docker/install-sh-smoke"),
]);

console.log(`==> Run installer smoke test (root): ${INSTALL_URL}`);
run("docker", [
  "run",
  "--rm",
  "-t",
  "-v",
  `${LATEST_DIR}:/out`,
  "-e",
  `OPENCLAW_INSTALL_URL=${INSTALL_URL}`,
// 🔒 VOTAL.AI Security Fix: Remote Code Execution via piping downloaded script to bash (curl | bash) [CWE-494] - CRITICAL
  "-e",
  "OPENCLAW_INSTALL_LATEST_OUT=/out/latest",
  "-e",
  `OPENCLAW_INSTALL_SMOKE_PREVIOUS=${envOr(
    "OPENCLAW_INSTALL_SMOKE_PREVIOUS",
    envOr("CLAWDBOT_INSTALL_SMOKE_PREVIOUS", ""),
  )}`,
  "-e",
  `OPENCLAW_INSTALL_SMOKE_SKIP_PREVIOUS=${envOr(
    "OPENCLAW_INSTALL_SMOKE_SKIP_PREVIOUS",
    envOr("CLAWDBOT_INSTALL_SMOKE_SKIP_PREVIOUS", "0"),
  )}`,
  "-e",
  "OPENCLAW_NO_ONBOARD=1",
  "-e",
  "DEBIAN_FRONTEND=noninteractive",
  SMOKE_IMAGE,
]);

let LATEST_VERSION = "";
if (fs.existsSync(LATEST_FILE) && fs.statSync(LATEST_FILE).isFile()) {
  LATEST_VERSION = fs.readFileSync(LATEST_FILE, "utf8").trim();
}

if (SKIP_NONROOT === "1") {
  console.log("==> Skip non-root installer smoke (OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1)");
} else {
  console.log(`==> Build non-root image: ${NONROOT_IMAGE}`);
  run("docker", [
    "build",
    "-t",
    NONROOT_IMAGE,
    "-f",
    path.join(ROOT_DIR, "scripts/docker/install-sh-nonroot/Dockerfile"),
    path.join(ROOT_DIR, "scripts/docker/install-sh-nonroot"),
  ]);

  console.log(`==> Run installer non-root test: ${INSTALL_URL}`);
  run("docker", [
    "run",
    "--rm",
    "-t",
    "-e",
    `OPENCLAW_INSTALL_URL=${INSTALL_URL}`,
    "-e",
    `OPENCLAW_INSTALL_EXPECT_VERSION=${LATEST_VERSION}`,
    "-e",
    "OPENCLAW_NO_ONBOARD=1",
    "-e",
    "DEBIAN_FRONTEND=noninteractive",
    NONROOT_IMAGE,
  ]);
}

if (envOr("OPENCLAW_INSTALL_SMOKE_SKIP_CLI", envOr("CLAWDBOT_INSTALL_SMOKE_SKIP_CLI", "0")) === "1") {
  console.log("==> Skip CLI installer smoke (OPENCLAW_INSTALL_SMOKE_SKIP_CLI=1)");
  process.exit(0);
}

if (SKIP_NONROOT === "1") {
  console.log("==> Skip CLI installer smoke (non-root image skipped)");
  process.exit(0);
}

console.log("==> Run CLI installer non-root test (same image)");
run("docker", [
  "run",
  "--rm",
  "-t",
  "--entrypoint",
  "/bin/bash",
  "-e",
  `OPENCLAW_INSTALL_URL=${INSTALL_URL}`,
  "-e",
  `OPENCLAW_INSTALL_CLI_URL=${CLI_INSTALL_URL}`,
  "-e",
  `OPENCLAW_INSTALL_CLI_SHA256=${CLI_INSTALL_SHA256}`,
  "-e",
  "OPENCLAW_NO_ONBOARD=1",
  "-e",
  "DEBIAN_FRONTEND=noninteractive",
  NONROOT_IMAGE,
  "-lc",
  `curl -fsSL "${CLI_INSTALL_URL}" -o /tmp/install-cli.sh && echo "${CLI_INSTALL_SHA256}  /tmp/install-cli.sh" | sha256sum -c - && bash /tmp/install-cli.sh --set-npm-prefix --no-onboard`,
]);