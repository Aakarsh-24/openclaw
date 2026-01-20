export function normalizeNextcloudTalkMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  let normalized = trimmed;

  // Strip common prefixes
  if (normalized.startsWith("nextcloud-talk:")) {
    normalized = normalized.slice("nextcloud-talk:".length).trim();
  } else if (normalized.startsWith("nc-talk:")) {
    normalized = normalized.slice("nc-talk:".length).trim();
  } else if (normalized.startsWith("nc:")) {
    normalized = normalized.slice("nc:".length).trim();
  }

  // Strip room: prefix if present
  if (normalized.startsWith("room:")) {
    normalized = normalized.slice("room:".length).trim();
  }

  if (!normalized) return undefined;

  // Return with canonical prefix
  return `nextcloud-talk:${normalized}`.toLowerCase();
}

export function looksLikeNextcloudTalkTargetId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;

  // Check for explicit prefixes
  if (/^(nextcloud-talk|nc-talk|nc):/i.test(trimmed)) return true;

  // Nextcloud Talk room tokens are typically alphanumeric strings
  // They're usually 8+ characters of mixed case letters and numbers
  return /^[a-z0-9]{8,}$/i.test(trimmed);
}
