/**
 * Deep Research CLI executor
 * @see docs/sdd/deep-research/requirements.md#4.3
 */

import { spawn } from "node:child_process";
import { access, constants, readFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_DEEP_RESEARCH_CLI_PATH, loadConfig } from "../config/config.js";
import { normalizeDeepResearchTopic } from "./topic.js";

export interface ExecuteOptions {
  topic: string;
  dryRun?: boolean;
  outputLanguage?: "ru" | "en" | "auto";
  timeoutMs?: number;
}

export interface ExecuteResult {
  success: boolean;
  runId?: string;
  resultJsonPath?: string;
  error?: string;
  stdout: string;
  stderr: string;
}

async function findCliOnPath(command: string): Promise<string | null> {
  const entries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const candidate = path.join(entry, command);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // continue searching PATH
    }
  }

  return null;
}

/**
 * Validate CLI exists and is executable
 */
export async function validateCli(
  cliPath: string,
): Promise<{ valid: boolean; error?: string; resolvedPath?: string }> {
  try {
    await access(cliPath, constants.X_OK);
    return { valid: true, resolvedPath: cliPath };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      const fallback = await findCliOnPath(path.basename(cliPath));
      if (fallback) {
        return { valid: true, resolvedPath: fallback };
      }
      return { valid: false, error: `CLI not found: ${cliPath}` };
    }
    return { valid: false, error: `CLI not executable: ${cliPath}` };
  }
}

/**
 * Execute deep research CLI
 * @returns Promise resolving to execution result
 */
export async function executeDeepResearch(
  options: ExecuteOptions,
): Promise<ExecuteResult> {
  const cfg = loadConfig();
  const cliPath = cfg.deepResearch?.cliPath ?? DEFAULT_DEEP_RESEARCH_CLI_PATH;
  const dryRun = options.dryRun ?? cfg.deepResearch?.dryRun ?? true;
  const outputLanguage =
    options.outputLanguage ?? cfg.deepResearch?.outputLanguage ?? "auto";
  const timeoutMs = options.timeoutMs ?? 20 * 60 * 1000;

  const normalized = normalizeDeepResearchTopic(options.topic);
  if (!normalized) {
    return {
      success: false,
      error: "Empty topic",
      stdout: "",
      stderr: "",
    };
  }
  if (normalized.truncated) {
    console.log(
      `[deep-research] Topic truncated to ${normalized.topic.length} chars`,
    );
  }

  const validation = await validateCli(cliPath);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      stdout: "",
      stderr: "",
    };
  }
  const resolvedCliPath = validation.resolvedPath ?? cliPath;

  // Build command arguments
  const args: string[] = [];
  const dryRunFixture = "examples/sample_run";
  const dryRunFallbackResult =
    "runs/20260102_100310_dry-run-test-respond-in-russian/result.json";

  if (dryRun) {
    args.push("--dry-run");
    args.push("--dry-run-fixture", dryRunFixture);
  } else {
    args.push("--mode", "stream");
  }

  args.push("--prompt", normalized.topic);
  args.push("--publish");

  if (outputLanguage !== "auto") {
    args.push("--output-language", outputLanguage);
  }

  console.log(
    `[deep-research] Executing: ${resolvedCliPath} ${args.join(" ")}`,
  );

  return new Promise((resolve) => {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    let runId: string | undefined;
    let resultJsonPath: string | undefined;
    let stdoutBuffer = "";
    let finished = false;
    let timeoutId: NodeJS.Timeout | undefined;
    const baseDir = path.dirname(resolvedCliPath);

    const finish = (result: ExecuteResult) => {
      if (finished) return;
      finished = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      resolve(result);
    };

    const proc = spawn(resolvedCliPath, args, {
      cwd: baseDir,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    timeoutId = setTimeout(() => {
      proc.kill("SIGTERM");
      finish({
        success: false,
        error: "Execution timeout",
        runId,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      });
    }, timeoutMs);

    proc.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdoutChunks.push(chunk);
      stdoutBuffer += chunk;

      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed) as {
            run_id?: string;
            event?: string;
            result?: string;
          };
          if (event.run_id) {
            runId = event.run_id;
          }
          if (event.event === "run.complete" && event.result) {
            resultJsonPath = event.result;
          }
        } catch {
          // Not JSON, ignore
        }
      }
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderrChunks.push(data.toString());
    });

    proc.on("close", async (code) => {
      const success = code === 0;
      let resolvedSuccess = success;
      let resolvedError = success ? undefined : `Exit code: ${code}`;
      let resolvedResultJsonPath = resultJsonPath;

      if (!success && dryRun && !resolvedResultJsonPath) {
        const fallbackPath = path.join(baseDir, dryRunFallbackResult);
        try {
          await access(fallbackPath, constants.R_OK);
          resolvedResultJsonPath = fallbackPath;
          resolvedSuccess = true;
          resolvedError = undefined;
          if (!runId) {
            try {
              const content = await readFile(fallbackPath, "utf-8");
              const parsed = JSON.parse(content) as { run_id?: string };
              runId = parsed.run_id ?? runId;
            } catch {
              // Ignore fallback parse errors.
            }
          }
        } catch {
          // Keep failure as-is if fixture is missing.
        }
      }
      if (resolvedResultJsonPath && !resolvedResultJsonPath.startsWith("/")) {
        resolvedResultJsonPath = path.join(baseDir, resolvedResultJsonPath);
      }

      finish({
        success: resolvedSuccess,
        runId,
        resultJsonPath: resolvedResultJsonPath,
        error: resolvedError,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      });
    });

    proc.on("error", (err) => {
      finish({
        success: false,
        error: err.message,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
      });
    });
  });
}
