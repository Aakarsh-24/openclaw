import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, "..");
const hashFile = path.resolve(rootDir, "src/canvas-host/a2ui/.bundle.hash");
const outputFile = path.resolve(rootDir, "src/canvas-host/a2ui/a2ui.bundle.js");
const a2uiRendererDir = path.resolve(rootDir, "vendor/a2ui/renderers/lit");
const a2uiAppDir = path.resolve(
  rootDir,
  "apps/shared/OpenClawKit/Tools/CanvasA2UI",
);

async function onError(): Promise<never> {
  console.error("A2UI bundling failed. Re-run with: pnpm canvas:a2ui:bundle");
  console.error("If this persists, verify pnpm deps and try again.");
  process.exit(1);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function walk(entryPath: string, files: string[]): Promise<void> {
  const st = await fs.stat(entryPath);
  if (st.isDirectory()) {
    const entries = await fs.readdir(entryPath);
    for (const entry of entries) {
      await walk(path.join(entryPath, entry), files);
    }
    return;
  }
  files.push(entryPath);
}

function normalizePath(p: string): string {
  return p.split(path.sep).join("/");
}

async function computeHash(inputPaths: string[]): Promise<string> {
  const files: string[] = [];

  for (const input of inputPaths) {
    await walk(input, files);
  }

  files.sort((a, b) => normalizePath(a).localeCompare(normalizePath(b)));

  const hash = createHash("sha256");
  for (const filePath of files) {
    const rel = normalizePath(path.relative(rootDir, filePath));
    hash.update(rel);
    hash.update("\0");
    hash.update(await fs.readFile(filePath));
    hash.update("\0");
  }

  return hash.digest("hex");
}

async function runCommand(
  command: string,
  args: string[],
  cwd?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: cwd ?? rootDir,
      stdio: "inherit",
      shell: true,
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

async function main(): Promise<void> {
  try {
    // Docker builds exclude vendor/apps via .dockerignore.
    // In that environment we must keep the prebuilt bundle.
    const hasA2uiRenderer = await exists(a2uiRendererDir);
    const hasA2uiApp = await exists(a2uiAppDir);

    if (!hasA2uiRenderer || !hasA2uiApp) {
      console.log("A2UI sources missing; keeping prebuilt bundle.");
      return;
    }

    const inputPaths = [
      path.resolve(rootDir, "package.json"),
      path.resolve(rootDir, "pnpm-lock.yaml"),
      a2uiRendererDir,
      a2uiAppDir,
    ];

    const currentHash = await computeHash(inputPaths);

    const hashFileExists = await exists(hashFile);
    if (hashFileExists) {
      const previousHash = (await fs.readFile(hashFile, "utf-8")).trim();
      const outputFileExists = await exists(outputFile);

      if (previousHash === currentHash && outputFileExists) {
        console.log("A2UI bundle up to date; skipping.");
        return;
      }
    }

    // Run tsc to compile a2ui renderer
    const tsconfigPath = path.resolve(a2uiRendererDir, "tsconfig.json");
    console.log("Compiling A2UI renderer...");
    await runCommand("pnpm", ["-s", "exec", "tsc", "-p", tsconfigPath]);

    // Run rolldown to bundle
    const rolldownConfigPath = path.resolve(a2uiAppDir, "rolldown.config.mjs");
    console.log("Bundling A2UI...");
    await runCommand("rolldown", ["-c", rolldownConfigPath]);

    // Save hash
    await fs.mkdir(path.dirname(hashFile), { recursive: true });
    await fs.writeFile(hashFile, currentHash);

    console.log("A2UI bundle completed successfully.");
  } catch (err) {
    console.error(err);
    await onError();
  }
}

main();
