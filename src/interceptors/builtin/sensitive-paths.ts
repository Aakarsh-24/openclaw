/**
 * Shared sensitive path definitions used by both security-audit (read/write/edit)
 * and command-safety-guard (cat/head/tail/etc. via exec).
 */

// Paths containing these substrings are blocked
export const BLOCKED_PATH_PATTERNS: string[] = [
  // User secrets
  ".aws/",
  ".gnupg/",
  ".password-store/",
  // SSH private keys
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  // System paths
  "/etc/passwd",
  "/etc/shadow",
  "/etc/sudoers",
  // Certificate/key files
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  // Environment files
  "/.env",
  // Cloud credentials
  "credentials.json",
  "service-account.json",
  ".boto",
  "kubeconfig",
  // Claude Code auth
  ".claude/.credentials.json",
  ".claude/credentials/",
  // OpenClaw / Clawdbot auth
  ".openclaw/credentials/",
  ".clawdbot/credentials/",
  "auth-profiles.json",
  // OpenAI Codex auth
  ".codex/auth.json",
  // Qwen / MiniMax portal OAuth
  ".qwen/oauth_creds.json",
  ".minimax/oauth_creds.json",
  // Google CLI OAuth
  "gogcli/credentials.json",
  // WhatsApp session creds
  "whatsapp/default/creds.json",
  // GitHub Copilot tokens
  "github-copilot.token.json",
  // Shell profile files (may export API keys)
  "/.profile",
  "/.bash_profile",
  "/.bashrc",
  "/.zshrc",
  "/.zprofile",
  "/.config/fish/config.fish",
];

// Paths that match a blocked pattern but are actually safe
export const ALLOWED_EXCEPTIONS: RegExp[] = [
  /node_modules\//,
  /\.test\./,
  /\/test\//,
  /\/fixtures\//,
  /package-lock\.json$/,
];

/**
 * Check if a file path refers to a sensitive file.
 */
export function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();

  for (const exception of ALLOWED_EXCEPTIONS) {
    if (exception.test(normalized)) {
      return false;
    }
  }

  for (const blocked of BLOCKED_PATH_PATTERNS) {
    if (normalized.includes(blocked.toLowerCase())) {
      return true;
    }
  }

  return false;
}
