/**
 * Command safety guard interceptor.
 * Blocks dangerous bash commands before they execute.
 */

import type { InterceptorRegistration } from "../types.js";

// Patterns that are always blocked — catastrophic or irreversible
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Filesystem destruction
  {
    pattern:
      /\brm\s+(-[rfI]*\s+)*(\/|\/\*|~|\$HOME|\/Users|\/home|\/var|\/etc|\/usr|\/bin|\/opt)(\s|$)/,
    reason: "Deleting critical system directories is not allowed",
  },
  {
    pattern: /\brm\s+(-[rfI]*\s+)*(\.|\.\.|\.\*)(\s|$)/,
    reason: "Deleting current directory or all hidden files is not allowed",
  },
  {
    pattern: /\brm\s+(-[rfI]*\s+)*\*(\s|$)/,
    reason: "Deleting all files in current directory is not allowed",
  },
  {
    pattern: /\bfind\s+\/\s+.*-delete/,
    reason: "Recursive deletion from root directory is not allowed",
  },
  // Disk operations
  {
    pattern: /\b(dd|mkfs|fdisk|parted|shred)\b.*(\/dev\/[sh]d|\/dev\/nvme|\/dev\/disk)/,
    reason: "Direct disk operations are not allowed",
  },
  // Permission disasters
  {
    pattern: /\bchmod\s+(-R\s+)?777\b/,
    reason: "chmod 777 is a security risk — use specific permissions instead",
  },
  {
    pattern: /\bchmod\s+(-R\s+)?000\s+\/(bin|usr|etc|\s|$)/,
    reason: "Removing permissions on system directories is not allowed",
  },
  {
    pattern: /\bchown\s+(-R\s+).*\/(\s|$)/,
    reason: "Changing ownership of root directory is not allowed",
  },
  // Fork bomb — matches :(){ :|:& };:
  {
    pattern: /:\(\)\s*\{/,
    reason: "Fork bombs are not allowed",
  },
  // System file corruption
  {
    pattern: /\b>\s*\/etc\/(passwd|sudoers|shadow|group)/,
    reason: "Overwriting critical system files is not allowed",
  },
  // Remote code execution
  {
    pattern: /(curl|wget)\s+[^|]*\|\s*(sudo\s+)?(bash|sh|python|ruby|perl)/,
    reason: "Piping remote content to interpreters is not allowed",
  },
  // Backdoors
  {
    pattern: /\bnc\s+-l.*(-e|>.*\/(bash|sh))/,
    reason: "Opening network backdoors is not allowed",
  },
  // Git --no-verify
  {
    pattern: /\bgit\s+commit\b.*--no-verify/,
    reason: "git commit --no-verify is not allowed — hooks must run",
  },
  // Docker nuke
  {
    pattern: /docker\s+system\s+prune\s+-a.*--volumes/,
    reason: "Wiping all Docker data including volumes is not allowed",
  },
];

/**
 * Remove quoted strings to reduce false positives.
 * Commands inside quotes (e.g. echo "rm -rf /") are less likely to be dangerous.
 */
function stripQuotedStrings(cmd: string): string {
  return cmd.replace(/'[^']*'/g, "").replace(/"[^"]*"/g, "");
}

export function createCommandSafetyGuard(): InterceptorRegistration<"tool.before"> {
  return {
    id: "builtin:command-safety-guard",
    name: "tool.before",
    priority: 100, // security — runs first
    toolMatcher: /^exec$/,
    handler: (_input, output) => {
      const cmd = typeof output.args.command === "string" ? output.args.command : "";
      const cleaned = stripQuotedStrings(cmd);

      for (const { pattern, reason } of BLOCKED_PATTERNS) {
        if (pattern.test(cleaned)) {
          output.block = true;
          output.blockReason = reason;
          return;
        }
      }
    },
  };
}
