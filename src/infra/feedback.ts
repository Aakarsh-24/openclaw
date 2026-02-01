export type FeedbackLevel = "silent" | "info" | "debug";

const FEEDBACK_ORDER: Record<FeedbackLevel, number> = {
  silent: 0,
  info: 1,
  debug: 2,
};

export function normalizeFeedbackLevel(raw?: string | null): FeedbackLevel | undefined {
  if (!raw) {
    return undefined;
  }
  const key = raw.trim().toLowerCase();
  if (["silent", "off", "false", "no", "none", "0"].includes(key)) {
    return "silent";
  }
  if (["info", "on", "true", "yes", "1", "default"].includes(key)) {
    return "info";
  }
  if (["debug", "verbose", "full", "trace", "2"].includes(key)) {
    return "debug";
  }
  return undefined;
}

export function resolveFeedbackLevel(raw?: string | null, fallback?: FeedbackLevel): FeedbackLevel {
  return normalizeFeedbackLevel(raw) ?? fallback ?? "info";
}

export function isFeedbackLevelAtLeast(level: FeedbackLevel, min: FeedbackLevel): boolean {
  return FEEDBACK_ORDER[level] >= FEEDBACK_ORDER[min];
}
