/**
 * Command safety guard interceptor.
 * Blocks dangerous bash commands before they execute.
 */

import type { InterceptorRegistration } from "../types.js";
import { isSensitivePath } from "./sensitive-paths.js";

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

// Commands that read file contents — the agent can use these to bypass the
// read/write/edit security audit interceptor.
const FILE_READ_COMMANDS =
  /\b(cat|head|tail|less|more|strings|xxd|hexdump|base64|tac|nl|od|bat|batcat)\b/;

// Commands that copy/exfiltrate files
const FILE_COPY_COMMANDS = /\b(cp|scp|rsync)\b/;

// Redirections that read a file: < file, $(< file)
const INPUT_REDIRECT = /(?:<\s*)(\S+)/g;

/**
 * Extract file path arguments from a command string.
 * Intentionally conservative — extracts tokens that look like paths
 * (start with / or ~ or . or contain /) after stripping flags.
 */
function extractPathArgs(cmd: string): string[] {
  const paths: string[] = [];
  // Split on pipes/semicolons/&& to get individual commands
  const segments = cmd.split(/[|;&]+/);
  for (const segment of segments) {
    const trimmed = segment.trim();
    // Skip if no file-read or file-copy command
    if (!FILE_READ_COMMANDS.test(trimmed) && !FILE_COPY_COMMANDS.test(trimmed)) {
      continue;
    }
    // Tokenize, skip flags (starting with -)
    const tokens = trimmed.split(/\s+/);
    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.startsWith("-")) {
        continue;
      }
      // Looks like a path
      if (
        token.startsWith("/") ||
        token.startsWith("~") ||
        token.startsWith(".") ||
        token.includes("/")
      ) {
        paths.push(token);
      }
    }
  }

  // Also check input redirections like < ~/.bashrc
  let match: RegExpExecArray | null = null;
  while ((match = INPUT_REDIRECT.exec(cmd)) !== null) {
    const path = match[1];
    if (path && !path.startsWith("-")) {
      paths.push(path);
    }
  }

  return paths;
}

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

      // Check destructive command patterns
      for (const { pattern, reason } of BLOCKED_PATTERNS) {
        if (pattern.test(cleaned)) {
          output.block = true;
          output.blockReason = reason;
          return;
        }
      }

      // Check for file-read/copy commands targeting sensitive paths
      const paths = extractPathArgs(cleaned);
      for (const path of paths) {
        // Expand ~ to a generic home path for matching
        const expanded = path.replace(/^~/, "/home/user");
        if (isSensitivePath(expanded)) {
          output.block = true;
          output.blockReason = `Access denied: command reads sensitive file "${path}"`;
          return;
        }
      }
    },
  };
}
