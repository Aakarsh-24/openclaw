import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { SessionManager } from "@mariozechner/pi-coding-agent";

import { makeMissingToolResult } from "./session-transcript-repair.js";
import { emitSessionTranscriptUpdate } from "../sessions/transcript-events.js";
import { sanitizeUserInput } from "../security/sanitization.js";
import {
  analyzeContent,
  type RiskLevel,
} from "../security/pattern-detector.js";

type ToolCall = { id: string; name?: string };

/**
 * Configuration for tool output security validation.
 */
export interface ToolOutputValidationConfig {
  /** Risk level threshold for blocking tool outputs */
  blockThreshold?: RiskLevel;
  /** Risk level threshold for sanitization */
  sanitizeThreshold?: RiskLevel;
  /** Whether to log validation events */
  enableLogging?: boolean;
  /** Tools to skip validation for (trusted tools) */
  trustedTools?: string[];
}

/**
 * Result of tool output validation.
 */
export interface ToolOutputValidationResult {
  /** Whether the output passed validation */
  valid: boolean;
  /** Whether the output was sanitized */
  sanitized: boolean;
  /** The validated (possibly sanitized) output */
  output: string;
  /** Risk level of the original output */
  riskLevel: RiskLevel;
  /** Detection summary */
  detection: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Extracts text content from a tool result message safely.
 */
function extractToolResultContent(message: AgentMessage): string {
  const msg = message as unknown as Record<string, unknown>;
  const content = msg?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    // Handle array content (some providers return structured results)
    return JSON.stringify(content);
  }
  if (content !== null && content !== undefined) {
    return String(content);
  }
  return "";
}

/**
 * Validates and optionally sanitizes tool output before it's fed back to the LLM.
 *
 * Tool outputs can be manipulated by attackers to inject prompts into the
 * conversation context. This function provides validation and sanitization.
 *
 * @param toolName - Name of the tool that produced the output
 * @param output - The raw tool output
 * @param config - Validation configuration
 * @returns Validation result with optional sanitization
 */
export function validateToolOutput(
  toolName: string,
  output: string,
  config: ToolOutputValidationConfig = {},
): ToolOutputValidationResult {
  const {
    blockThreshold = "critical",
    sanitizeThreshold = "medium",
    trustedTools = [],
  } = config;

  // Skip validation for trusted tools
  if (trustedTools.includes(toolName)) {
    return {
      valid: true,
      sanitized: false,
      output,
      riskLevel: "low",
      detection: { critical: 0, high: 0, medium: 0, low: 0 },
    };
  }

  // Analyze the output
  const analysis = analyzeContent(output);
  const riskOrder: RiskLevel[] = ["low", "medium", "high", "critical"];
  const blockIndex = riskOrder.indexOf(blockThreshold);
  const contentIndex = riskOrder.indexOf(analysis.riskLevel);

  // Determine if we should block
  const shouldBlock = contentIndex >= blockIndex;

  // Determine if we should sanitize
  const shouldSanitize =
    contentIndex >= 0 &&
    contentIndex < blockIndex &&
    contentIndex >= riskOrder.indexOf(sanitizeThreshold);

  if (shouldBlock) {
    return {
      valid: false,
      sanitized: false,
      output: "[TOOL OUTPUT REDACTED - security concern]",
      riskLevel: analysis.riskLevel,
      detection: {
        critical: analysis.matches.filter((m) => m.risk === "critical").length,
        high: analysis.matches.filter((m) => m.risk === "high").length,
        medium: analysis.matches.filter((m) => m.risk === "medium").length,
        low: analysis.matches.filter((m) => m.risk === "low").length,
      },
    };
  }

  if (shouldSanitize) {
    const sanitizedOutput = sanitizeUserInput(output);
    return {
      valid: true,
      sanitized: sanitizedOutput !== output,
      output: sanitizedOutput,
      riskLevel: analysis.riskLevel,
      detection: {
        critical: analysis.matches.filter((m) => m.risk === "critical").length,
        high: analysis.matches.filter((m) => m.risk === "high").length,
        medium: analysis.matches.filter((m) => m.risk === "medium").length,
        low: analysis.matches.filter((m) => m.risk === "low").length,
      },
    };
  }

  return {
    valid: true,
    sanitized: false,
    output,
    riskLevel: analysis.riskLevel,
    detection: {
      critical: analysis.matches.filter((m) => m.risk === "critical").length,
      high: analysis.matches.filter((m) => m.risk === "high").length,
      medium: analysis.matches.filter((m) => m.risk === "medium").length,
      low: analysis.matches.filter((m) => m.risk === "low").length,
    },
  };
}

/**
 * Creates a transform function for tool results with security validation.
 *
 * This can be passed to installSessionToolResultGuard as the
 * transformToolResultForPersistence option.
 */
export function createSecurityTransform(
  config: ToolOutputValidationConfig = {},
): (
  message: AgentMessage,
  meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean },
) => AgentMessage {
  return (
    message: AgentMessage,
    meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean },
  ) => {
    // Only validate tool results
    const role = (message as { role?: unknown }).role;
    if (role !== "toolResult") {
      return message;
    }

    // Skip synthetic results
    if (meta.isSynthetic) {
      return message;
    }

    const toolName = meta.toolName ?? "unknown";
    const content = extractToolResultContent(message);

    if (!content) {
      return message;
    }

    const result = validateToolOutput(toolName, content, config);

    if (!result.valid) {
      // Replace with redacted message
      const msg = message as unknown as Record<string, unknown>;
      if (Array.isArray(msg.content)) {
        // Handle array content
        (msg as { content: unknown }).content = [
          {
            type: "toolResult",
            content: result.output,
            isError: true,
          },
        ];
      } else {
        (msg as { content: string }).content = result.output;
      }
      return message as AgentMessage;
    }

    if (result.sanitized) {
      // Replace with sanitized content
      const msg = message as unknown as Record<string, unknown>;
      if (Array.isArray(msg.content)) {
        (msg as { content: unknown }).content = [
          {
            type: "toolResult",
            content: result.output,
            isError: false,
          },
        ];
      } else {
        (msg as { content: string }).content = result.output;
      }
    }

    return message as AgentMessage;
  };
}

function extractAssistantToolCalls(
  msg: Extract<AgentMessage, { role: "assistant" }>,
): ToolCall[] {
  const content = msg.content;
  if (!Array.isArray(content)) return [];

  const toolCalls: ToolCall[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const rec = block as { type?: unknown; id?: unknown; name?: unknown };
    if (typeof rec.id !== "string" || !rec.id) continue;
    if (
      rec.type === "toolCall" ||
      rec.type === "toolUse" ||
      rec.type === "functionCall"
    ) {
      toolCalls.push({
        id: rec.id,
        name: typeof rec.name === "string" ? rec.name : undefined,
      });
    }
  }
  return toolCalls;
}

function extractToolResultId(
  msg: Extract<AgentMessage, { role: "toolResult" }>,
): string | null {
  const toolCallId = (msg as { toolCallId?: unknown }).toolCallId;
  if (typeof toolCallId === "string" && toolCallId) return toolCallId;
  const toolUseId = (msg as { toolUseId?: unknown }).toolUseId;
  if (typeof toolUseId === "string" && toolUseId) return toolUseId;
  return null;
}

export function installSessionToolResultGuard(
  sessionManager: SessionManager,
  opts?: {
    /**
     * Optional, synchronous transform applied to toolResult messages *before* they are
     * persisted to the session transcript.
     */
    transformToolResultForPersistence?: (
      message: AgentMessage,
      meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean },
    ) => AgentMessage;
    /**
     * Whether to synthesize missing tool results to satisfy strict providers.
     * Defaults to true.
     */
    allowSyntheticToolResults?: boolean;
  },
): {
  flushPendingToolResults: () => void;
  getPendingIds: () => string[];
} {
  const originalAppend = sessionManager.appendMessage.bind(sessionManager);
  const pending = new Map<string, string | undefined>();

  const persistToolResult = (
    message: AgentMessage,
    meta: { toolCallId?: string; toolName?: string; isSynthetic?: boolean },
  ) => {
    const transformer = opts?.transformToolResultForPersistence;
    return transformer ? transformer(message, meta) : message;
  };

  const allowSyntheticToolResults = opts?.allowSyntheticToolResults ?? true;

  const flushPendingToolResults = () => {
    if (pending.size === 0) return;
    if (allowSyntheticToolResults) {
      for (const [id, name] of pending.entries()) {
        const synthetic = makeMissingToolResult({
          toolCallId: id,
          toolName: name,
        });
        originalAppend(
          persistToolResult(synthetic, {
            toolCallId: id,
            toolName: name,
            isSynthetic: true,
          }) as never,
        );
      }
    }
    pending.clear();
  };

  const guardedAppend = (message: AgentMessage) => {
    const role = (message as { role?: unknown }).role;

    if (role === "toolResult") {
      const id = extractToolResultId(
        message as Extract<AgentMessage, { role: "toolResult" }>,
      );
      const toolName = id ? pending.get(id) : undefined;
      if (id) pending.delete(id);
      return originalAppend(
        persistToolResult(message, {
          toolCallId: id ?? undefined,
          toolName,
          isSynthetic: false,
        }) as never,
      );
    }

    const toolCalls =
      role === "assistant"
        ? extractAssistantToolCalls(
            message as Extract<AgentMessage, { role: "assistant" }>,
          )
        : [];

    if (allowSyntheticToolResults) {
      // If previous tool calls are still pending, flush before non-tool results.
      if (
        pending.size > 0 &&
        (toolCalls.length === 0 || role !== "assistant")
      ) {
        flushPendingToolResults();
      }
      // If new tool calls arrive while older ones are pending, flush the old ones first.
      if (pending.size > 0 && toolCalls.length > 0) {
        flushPendingToolResults();
      }
    }

    const result = originalAppend(message as never);

    const sessionFile = (
      sessionManager as { getSessionFile?: () => string | null }
    ).getSessionFile?.();
    if (sessionFile) {
      emitSessionTranscriptUpdate(sessionFile);
    }

    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        pending.set(call.id, call.name);
      }
    }

    return result;
  };

  // Monkey-patch appendMessage with our guarded version.
  sessionManager.appendMessage =
    guardedAppend as SessionManager["appendMessage"];

  return {
    flushPendingToolResults,
    getPendingIds: () => Array.from(pending.keys()),
  };
}
