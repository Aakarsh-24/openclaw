#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const env = { ...process.env };
const cwd = process.cwd();
const compilerOverride = env.OPENCLAW_TS_COMPILER ?? env.CLAWDBOT_TS_COMPILER;
const compiler = compilerOverride === "tsc" ? "tsc" : "tsgo";
const projectArgs = ["--project", "tsconfig.json"];

const distRoot = path.join(cwd, "dist");
const distEntry = path.join(distRoot, "/entry.js");
const buildStampPath = path.join(distRoot, ".buildstamp");
const srcRoot = path.join(cwd, "src");
const configFiles = [path.join(cwd, "tsconfig.json"), path.join(cwd, "package.json")];

const statMtime = (filePath) => {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
};

const isExcludedSource = (filePath) => {
  const relativePath = path.relative(srcRoot, filePath);
  if (relativePath.startsWith("..")) {
    return false;
  }
  return (
    relativePath.endsWith(".test.ts") ||
    relativePath.endsWith(".test.tsx") ||
    relativePath.endsWith(`test-helpers.ts`)
  );
};

const hasNewerSource = (dirPath, thresholdMtime, shouldSkip) => {
  try {
    // Node 20+ supports recursive readdir.
    // This avoids the overhead of manual directory traversal in JS.
    const entries = fs.readdirSync(dirPath, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const parentPath = entry.parentPath ?? entry.path;
      const fullPath = path.join(parentPath, entry.name);

      if (shouldSkip?.(fullPath)) {
        continue;
      }

      // Fast path: early exit as soon as we find a newer file
      const mtime = statMtime(fullPath);
      if (mtime != null && mtime > thresholdMtime) {
        return true;
      }
    }
  } catch {
    // If we can't read the directory (e.g. permission or version issue), assume dirty.
    return true;
  }
  return false;
};

const shouldBuild = () => {
  if (env.OPENCLAW_FORCE_BUILD === "1") {
    return true;
  }
  const stampMtime = statMtime(buildStampPath);
  if (stampMtime == null) {
    return true;
  }
  if (statMtime(distEntry) == null) {
    return true;
  }

  for (const filePath of configFiles) {
    const mtime = statMtime(filePath);
    if (mtime != null && mtime > stampMtime) {
      return true;
    }
  }

  // Check src/ with early exit
  if (hasNewerSource(srcRoot, stampMtime, isExcludedSource)) {
    return true;
  }
  return false;
};

const logRunner = (message) => {
  if (env.OPENCLAW_RUNNER_LOG === "0") {
    return;
  }
  process.stderr.write(`[openclaw] ${message}\n`);
};

const runNode = () => {
  const nodeProcess = spawn(process.execPath, ["openclaw.mjs", ...args], {
    cwd,
    env,
    stdio: "inherit",
  });

  nodeProcess.on("exit", (exitCode, exitSignal) => {
    if (exitSignal) {
      process.exit(1);
    }
    process.exit(exitCode ?? 1);
  });
};

const writeBuildStamp = () => {
  try {
    fs.mkdirSync(distRoot, { recursive: true });
    fs.writeFileSync(buildStampPath, `${Date.now()}\n`);
  } catch (error) {
    // Best-effort stamp; still allow the runner to start.
    logRunner(`Failed to write build stamp: ${error?.message ?? "unknown error"}`);
  }
};

if (!shouldBuild()) {
  runNode();
} else {
  logRunner("Building TypeScript (dist is stale).");

  let buildCmd = "";
  let buildArgs = [];

  // Optimization: Bypass pnpm overhead by invoking binary directly if possible (non-Windows only)
  // Windows needs complex .cmd handling or shell invocation, so we stick to pnpm there.
  const localBin = path.join(cwd, "node_modules", ".bin", compiler);
  const canUseLocalBin = process.platform !== "win32" && fs.existsSync(localBin);

  if (canUseLocalBin) {
    buildCmd = localBin;
    buildArgs = projectArgs;
  } else {
    const pnpmArgs = ["exec", compiler, ...projectArgs];
    buildCmd = process.platform === "win32" ? "cmd.exe" : "pnpm";
    buildArgs = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm", ...pnpmArgs] : pnpmArgs;
  }

  const build = spawn(buildCmd, buildArgs, {
    cwd,
    env,
    stdio: "inherit",
  });

  build.on("exit", (code, signal) => {
    if (signal) {
      process.exit(1);
    }
    if (code !== 0 && code !== null) {
      process.exit(code);
    }
    writeBuildStamp();
    runNode();
  });
}
