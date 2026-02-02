import type { AgentMessage } from "@mariozechner/pi-agent-core";

import { sanitizeUserInput } from "../../security/sanitization.js";
import {
  analyzeContent,
  type RiskLevel,
} from "../../security/pattern-detector.js";
import type { OpenClawConfig } from "../../config/config.js";

const THREAD_SUFFIX_REGEX = /^(.*)(?::(?:thread|topic):\d+)$/i;

function stripThreadSuffix(value: string): string {
  const match = value.match(THREAD_SUFFIX_REGEX);
  return match?.[1] ?? value;
}

/**
 * Limits conversation history to the last N user turns (and their associated
 * assistant responses). This reduces token usage for long-running DM sessions.
 */
export function limitHistoryTurns(
  messages: AgentMessage[],
  limit: number | undefined,
): AgentMessage[] {
  if (!limit || limit <= 0 || messages.length === 0) return messages;

  let userCount = 0;
  let lastUserIndex = messages.length;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      userCount++;
      if (userCount > limit) {
        return messages.slice(lastUserIndex);
      }
      lastUserIndex = i;
    }
  }
  return messages;
}

/**
 * Extract provider + user ID from a session key and look up dmHistoryLimit.
 * Supports per-DM overrides and provider defaults.
 */
export function getDmHistoryLimitFromSessionKey(
  sessionKey: string | undefined,
  config: OpenClawConfig | undefined,
): number | undefined {
  if (!sessionKey || !config) return undefined;

  const parts = sessionKey.split(":").filter(Boolean);
  const providerParts =
    parts.length >= 3 && parts[0] === "agent" ? parts.slice(2) : parts;

  const provider = providerParts[0]?.toLowerCase();
  if (!provider) return undefined;

  const kind = providerParts[1]?.toLowerCase();
  const userIdRaw = providerParts.slice(2).join(":");
  const userId = stripThreadSuffix(userIdRaw);
  if (kind !== "dm") return undefined;

  const getLimit = (
    providerConfig:
      | {
          dmHistoryLimit?: number;
          dms?: Record<string, { historyLimit?: number }>;
        }
      | undefined,
  ): number | undefined => {
    if (!providerConfig) return undefined;
    if (userId && providerConfig.dms?.[userId]?.historyLimit !== undefined) {
      return providerConfig.dms[userId].historyLimit;
    }
    return providerConfig.dmHistoryLimit;
  };

  const resolveProviderConfig = (
    cfg: OpenClawConfig | undefined,
    providerId: string,
  ):
    | {
        dmHistoryLimit?: number;
        dms?: Record<string, { historyLimit?: number }>;
      }
    | undefined => {
    const channels = cfg?.channels;
    if (!channels || typeof channels !== "object") return undefined;
    const entry = (channels as Record<string, unknown>)[providerId];
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      return undefined;
    return entry as {
      dmHistoryLimit?: number;
      dms?: Record<string, { historyLimit?: number }>;
    };
  };

  return getLimit(resolveProviderConfig(config, provider));
}

/**
 * Configuration for session history sanitization.
 */
export interface SanitizeHistoryOptions {
  /** Risk level threshold for blocking content (default: critical) */
  blockThreshold?: RiskLevel;
  /** Risk level threshold for sanitization (default: medium) */
  sanitizeThreshold?: RiskLevel;
  /** Maximum number of consecutive suspicious turns before quarantine */
  maxSuspiciousTurns?: number;
}

/**
 * Result of session history sanitization.
 */
export interface SanitizeHistoryResult {
  /** Sanitized history turns */
  sanitized: Array<{ role: "user" | "assistant"; content: string }>;
  /** Whether any content was modified */
  modified: boolean;
  /** Number of turns removed entirely */
  removed: number;
  /** Number of turns sanitized */
  sanitizedCount: number;
  /** Detection summary */
  detection: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Extracts text content from an AgentMessage safely.
 */
function getMessageContent(message: AgentMessage): string {
  // Use unknown as intermediate step to avoid type errors
  const msg = message as unknown as Record<string, unknown>;
  if (typeof msg?.content === "string") {
    return msg.content;
  }
  return "";
}

/**
 * Scans a single turn for potential injection attempts.
 */
function scanTurn(
  turn: AgentMessage,
  blockThreshold: RiskLevel,
): {
  shouldRemove: boolean;
  shouldSanitize: boolean;
  risk: RiskLevel;
  analysis: ReturnType<typeof analyzeContent>;
} {
  // Only scan user content (assistant responses are less risky but can be manipulated)
  if (turn.role !== "user") {
    return {
      shouldRemove: false,
      shouldSanitize: false,
      risk: "low",
      analysis: null as never,
    };
  }

  const content = getMessageContent(turn);
  const analysis = analyzeContent(content);

  const riskOrder: RiskLevel[] = ["low", "medium", "high", "critical"];
  const blockIndex = riskOrder.indexOf(blockThreshold);
  const contentIndex = riskOrder.indexOf(analysis.riskLevel);

  return {
    shouldRemove: contentIndex >= blockIndex,
    shouldSanitize: contentIndex >= 0 && contentIndex < blockIndex,
    risk: analysis.riskLevel,
    analysis,
  };
}

/**
 * Sanitizes session history by scanning and cleaning potentially injected content.
 *
 * This function helps prevent prompt injection attacks that accumulate in session
 * history over multiple turns. It can:
 * - Remove highly suspicious turns entirely
 * - Sanitize moderately suspicious content
 * - Flag suspicious content for monitoring
 *
 * @param messages - Original conversation history
 * @param options - Sanitization configuration
 * @returns Sanitized history with metadata
 */
export function sanitizeSessionHistory(
  messages: AgentMessage[],
  options: SanitizeHistoryOptions = {},
): SanitizeHistoryResult {
  const {
    blockThreshold = "critical",
    sanitizeThreshold = "medium",
    maxSuspiciousTurns = 3,
  } = options;

  let removed = 0;
  let sanitizedCount = 0;
  const detection = { critical: 0, high: 0, medium: 0, low: 0 };
  let consecutiveSuspicious = 0;

  const sanitized = messages
    .filter((turn) => {
      // Skip non-user turns (they're from the assistant, not user input)
      if (turn.role !== "user") {
        consecutiveSuspicious = 0;
        return true;
      }

      const { shouldRemove, shouldSanitize, risk, analysis } = scanTurn(
        turn,
        blockThreshold,
      );

      detection[risk]++;

      if (shouldRemove) {
        removed++;
        consecutiveSuspicious++;
        return false; // Remove this turn
      }

      if (shouldSanitize && analysis) {
        const originalContent = getMessageContent(turn);
        const sanitizedContent = sanitizeUserInput(originalContent);

        // Check if sanitization changed the content
        if (sanitizedContent !== originalContent) {
          sanitizedCount++;
          // Note: We can't modify the original message, but we'll track this
        }
        consecutiveSuspicious++;
      } else {
        consecutiveSuspicious = 0;
      }

      // Quarantine if too many consecutive suspicious turns
      if (consecutiveSuspicious >= maxSuspiciousTurns) {
        // Reset and mark this section as quarantined
        removed += 1;
        consecutiveSuspicious = 0;
        return false;
      }

      return true;
    })
    .map((turn) => ({
      role: turn.role as "user" | "assistant",
      content: getMessageContent(turn),
    }));

  return {
    sanitized,
    modified: removed > 0 || sanitizedCount > 0,
    removed,
    sanitizedCount,
    detection,
  };
}

/**
 * Analyzes session history for injection patterns without modifying it.
 *
 * @param messages - Conversation history to analyze
 * @returns Analysis of potential injection attempts in history
 */
export function analyzeSessionHistory(messages: AgentMessage[]): {
  totalTurns: number;
  suspiciousTurns: number;
  detection: Record<RiskLevel, number>;
  riskLevel: RiskLevel;
  recommendations: string[];
} {
  const detection = { critical: 0, high: 0, medium: 0, low: 0 };
  let suspiciousTurns = 0;

  for (const turn of messages) {
    if (turn.role !== "user") continue;

    const content = getMessageContent(turn);
    const analysis = analyzeContent(content);

    if (analysis.isSuspicious) {
      suspiciousTurns++;
      detection[analysis.riskLevel]++;
    }
  }

  // Determine overall risk
  let riskLevel: RiskLevel = "low";
  if (detection.critical > 0) riskLevel = "critical";
  else if (detection.high > 2) riskLevel = "critical";
  else if (detection.high > 0) riskLevel = "high";
  else if (detection.medium > 3) riskLevel = "high";
  else if (detection.medium > 0) riskLevel = "medium";

  // Generate recommendations
  const recommendations: string[] = [];
  if (suspiciousTurns > 0) {
    recommendations.push(
      `Found ${suspiciousTurns} potentially suspicious turns`,
    );
  }
  if (detection.critical > 0) {
    recommendations.push(
      "CRITICAL: Remove critical-risk turns before proceeding",
    );
  }
  if (detection.high > 2) {
    recommendations.push(
      "Multiple high-risk detections - consider session reset",
    );
  }
  if (detection.high > 0) {
    recommendations.push(
      "Sanitize high-risk content or use sanitizeSessionHistory",
    );
  }
  if (detection.medium > 0) {
    recommendations.push("Monitor medium-risk content for escalation");
  }

  return {
    totalTurns: messages.length,
    suspiciousTurns,
    detection,
    riskLevel,
    recommendations,
  };
}

/**
 * Creates a quarantine notice for removed content.
 */
export function createHistoryQuarantineNotice(
  removed: number,
  sanitized: number,
): string {
  const parts: string[] = [];

  if (removed > 0) {
    parts.push(`${removed} turn(s) removed due to security concerns`);
  }
  if (sanitized > 0) {
    parts.push(`${sanitized} turn(s) sanitized`);
  }

  if (parts.length === 0) {
    return "";
  }

  return (
    `\n\n⚠️ SECURITY NOTICE: Conversation history was filtered (${parts.join(", ")}). ` +
    "Some previous context may have been removed for security."
  );
}
