/**
 * Build a minimal PATH for gateway daemon services.
 *
 * The gateway runtime only needs:
 * - bun (to execute the gateway)
 * - system binaries (git, ssh, curl, chromium, etc.)
 *
 * We intentionally exclude package managers (pnpm, npm) and version managers
 * (nvm, fnm, volta) since they're only needed at install/dev time, not runtime.
 * This keeps the service environment clean and avoids hardcoding version-specific
 * paths that break when you upgrade Node or switch versions.
 *
 * DISPLAY and other runtime variables should be set in the .env file
 * (~/.clawdbot/.env) which is loaded early by the gateway via loadDotEnv().
 */

import os from "node:os";
import path from "node:path";

const SYSTEM_PATH_DIRS = ["/usr/local/bin", "/usr/bin", "/bin"];

/**
 * Resolve the bun binary directory.
 * Checks common install locations in order of preference.
 */
function resolveBunDir(env: Record<string, string | undefined>): string | null {
  const home = env.HOME ?? os.homedir();
  const candidates = [
    env.BUN_INSTALL ? path.join(env.BUN_INSTALL, "bin") : null,
    path.join(home, ".bun", "bin"),
    "/usr/local/bin", // homebrew or manual install
  ].filter(Boolean) as string[];

  // Return first candidate that's likely valid
  // We don't check file existence here to keep it fast and pure
  for (const dir of candidates) {
    if (dir.includes(".bun") || dir.includes("bun")) {
      return dir;
    }
  }
  return candidates[0] ?? null;
}

export type BuildServicePathOptions = {
  env?: Record<string, string | undefined>;
  /**
   * Extra directories to include in PATH (e.g., for custom tools).
   * Added after bun but before system directories.
   */
  extraDirs?: string[];
};

/**
 * Build a minimal PATH for the gateway service.
 *
 * Order: bun → extra → system
 *
 * @example
 * ```ts
 * const PATH = buildMinimalServicePath({ env: process.env });
 * // → "/home/user/.bun/bin:/usr/local/bin:/usr/bin:/bin"
 * ```
 */
export function buildMinimalServicePath(
  options: BuildServicePathOptions = {},
): string {
  const env = options.env ?? process.env;
  const extraDirs = options.extraDirs ?? [];

  const parts: string[] = [];

  // 1. Bun directory (required for gateway execution)
  const bunDir = resolveBunDir(env);
  if (bunDir) {
    parts.push(bunDir);
  }

  // 2. Extra directories (optional, for custom tools)
  for (const dir of extraDirs) {
    if (dir && !parts.includes(dir)) {
      parts.push(dir);
    }
  }

  // 3. System directories
  for (const dir of SYSTEM_PATH_DIRS) {
    if (!parts.includes(dir)) {
      parts.push(dir);
    }
  }

  return parts.join(path.delimiter);
}

/**
 * Build the environment record for the gateway service.
 *
 * Uses a minimal PATH and includes only necessary CLAWDBOT_* variables.
 * Runtime variables like DISPLAY should be in ~/.clawdbot/.env instead.
 */
export function buildServiceEnvironment(params: {
  env: Record<string, string | undefined>;
  port: number;
  token?: string;
  launchdLabel?: string;
}): Record<string, string | undefined> {
  const { env, port, token, launchdLabel } = params;

  return {
    PATH: buildMinimalServicePath({ env }),
    CLAWDBOT_PROFILE: env.CLAWDBOT_PROFILE,
    CLAWDBOT_STATE_DIR: env.CLAWDBOT_STATE_DIR,
    CLAWDBOT_CONFIG_PATH: env.CLAWDBOT_CONFIG_PATH,
    CLAWDBOT_GATEWAY_PORT: String(port),
    CLAWDBOT_GATEWAY_TOKEN: token,
    CLAWDBOT_LAUNCHD_LABEL: launchdLabel,
  };
}
