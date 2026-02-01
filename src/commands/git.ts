import type { RuntimeEnv } from "../runtime.js";
import { parseGitStatusPorcelainV2 } from "../git/porcelain-v2.js";
import { runCommandWithTimeout } from "../process/exec.js";

export async function gitStatusCommand(
  opts: { json: boolean; verbose: boolean },
  runtime: RuntimeEnv,
) {
  const args = ["git"];

  // If JSON is requested, use porcelain v2 for easier parsing
  if (opts.json) {
    // Force stable, machine-parseable path quoting even if the user has core.quotepath=false.
    args.push("-c", "core.quotepath=true", "status", "--porcelain=v2", "--branch");
  } else {
    // Otherwise force colors for human readability
    args.push("-c", "color.status=always", "status");
  }

  let res: Awaited<ReturnType<typeof runCommandWithTimeout>>;
  try {
    res = await runCommandWithTimeout(args, 10_000);
  } catch (err) {
    const code =
      typeof (err as { code?: unknown } | undefined)?.code === "string"
        ? (err as { code: string }).code
        : undefined;

    // Mirror common shell exit codes:
    // - 127: command not found
    // - 126: found but not executable
    const exitCode = code === "ENOENT" ? 127 : code === "EACCES" ? 126 : 1;
    const errorMsg =
      code === "ENOENT"
        ? "git is not installed or not on PATH"
        : code === "EACCES"
          ? "git is not executable"
          : "Failed to run git";

    runtime.error(errorMsg);
    if (opts.verbose) {
      runtime.error(String(err));
    }
    runtime.exit(exitCode);
    return;
  }

  if (res.code !== 0) {
    const errorMsg = res.stderr.trim() || res.stdout.trim() || "Git status failed";
    runtime.error(errorMsg);
    if (opts.verbose) {
      const stdout = res.stdout.trim();
      const stderr = res.stderr.trim();

      if (stdout && stdout !== errorMsg) {
        runtime.error(`stdout:\n${stdout}`);
      }
      if (stderr && stderr !== errorMsg) {
        runtime.error(`stderr:\n${stderr}`);
      }
    }
    // 128 is "not a git repository" usually
    runtime.exit(res.code ?? 1);
    return;
  }

  if (opts.json) {
    const result = parseGitStatusPorcelainV2(res.stdout);
    runtime.log(JSON.stringify(result, null, 2));
  } else {
    runtime.log(res.stdout.trimEnd());
  }
}
