import { formatToolDetail, resolveToolDisplay } from "../agents/tool-display.js";
import type { FeedbackLevel } from "./feedback.js";

type FeedbackFormatOptions = {
  includeLifecycle?: boolean;
  includeAssistant?: boolean;
  includeTool?: boolean;
  includeCompaction?: boolean;
};

export type AgentFeedbackEvent = {
  stream?: string;
  data?: Record<string, unknown>;
};

const DEFAULT_FORMAT_OPTIONS: Required<FeedbackFormatOptions> = {
  includeLifecycle: true,
  includeAssistant: true,
  includeTool: true,
  includeCompaction: true,
};

const MAX_LABEL_LENGTH = 120;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clampLabel(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length <= MAX_LABEL_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_LABEL_LENGTH - 3)}...`;
}

export function formatAgentFeedbackLabel(
  event: AgentFeedbackEvent,
  level: FeedbackLevel,
  options: FeedbackFormatOptions = {},
): string | undefined {
  if (level === "silent") {
    return undefined;
  }
  const opts = { ...DEFAULT_FORMAT_OPTIONS, ...options };
  const stream = normalizeString(event.stream);
  const data = event.data ?? {};

  if (stream === "lifecycle" && opts.includeLifecycle) {
    const phase = normalizeString(data.phase);
    if (phase === "start") {
      return "thinking";
    }
    if (phase === "end") {
      return "finalizing";
    }
    if (phase === "error") {
      return "error";
    }
  }

  if (stream === "assistant" && opts.includeAssistant) {
    return "streaming reply";
  }

  if (stream === "compaction" && opts.includeCompaction) {
    const phase = normalizeString(data.phase);
    if (phase === "start") {
      return "compacting";
    }
    if (phase === "end") {
      return data.willRetry === true ? "compaction retrying" : "compaction complete";
    }
  }

  if (stream === "tool" && opts.includeTool) {
    const phase = normalizeString(data.phase);
    if (phase && phase !== "start" && phase !== "result" && phase !== "update") {
      return undefined;
    }
    if (phase === "update" && level !== "debug") {
      return undefined;
    }

    const name = normalizeString(data.name) || "tool";
    const args = data.args;
    const meta = normalizeString(data.meta);
    const display = resolveToolDisplay({
      name,
      args,
      meta: meta || undefined,
    });
    const detail = level === "debug" ? formatToolDetail(display) : undefined;
    let label = `tool: ${display.label}`;
    if (detail) {
      label = `${label} - ${detail}`;
    }
    if (data.isError === true) {
      label = `${label} (error)`;
    }
    return clampLabel(label);
  }

  if (stream === "error") {
    return "error";
  }

  return undefined;
}
