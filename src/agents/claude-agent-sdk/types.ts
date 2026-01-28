/**
 * Type definitions for the Claude Agent SDK integration.
 */

import type { MoltbotConfig } from "../../config/config.js";
import type { CcSdkModelTiers } from "../../config/types.agents.js";

/** Provider environment variables for SDK authentication and model config. */
export type SdkProviderEnv = {
  /** Anthropic API key or OAuth token. */
  ANTHROPIC_API_KEY?: string;
  /** OAuth access token (alternative to API key). */
  ANTHROPIC_AUTH_TOKEN?: string;
  /** Custom base URL for API requests. */
  ANTHROPIC_BASE_URL?: string;
  /** Use Bedrock backend. */
  CLAUDE_CODE_USE_BEDROCK?: string;
  /** Use Vertex AI backend. */
  CLAUDE_CODE_USE_VERTEX?: string;
  /** Model for fast/simple tasks (Haiku tier). */
  ANTHROPIC_DEFAULT_HAIKU_MODEL?: string;
  /** Model for balanced tasks (Sonnet tier). */
  ANTHROPIC_DEFAULT_SONNET_MODEL?: string;
  /** Model for complex reasoning (Opus tier). */
  ANTHROPIC_DEFAULT_OPUS_MODEL?: string;
};

/** Provider configuration for SDK runner. */
export type SdkProviderConfig = {
  /** Human-readable provider name. */
  name: string;
  /** Environment variables to set for authentication. */
  env: SdkProviderEnv;
  /** Model override (if different from config). */
  model?: string;
};

/** Parameters for SDK runner execution. */
export type SdkRunnerParams = {
  /** Session identifier. */
  sessionId: string;
  /** Session key for routing. */
  sessionKey?: string;
  /** Path to session file for conversation history. */
  sessionFile: string;
  /** Agent workspace directory. */
  workspaceDir: string;
  /** Agent data directory. */
  agentDir?: string;
  /** Moltbot configuration. */
  config?: MoltbotConfig;
  /** User prompt/message. */
  prompt: string;
  /** Model to use (provider/model format). */
  model?: string;
  /** Provider configuration. */
  providerConfig?: SdkProviderConfig;
  /** Timeout in milliseconds. */
  timeoutMs: number;
  /** Run identifier for event correlation. */
  runId: string;
  /** Abort signal for cancellation. */
  abortSignal?: AbortSignal;
  /** Extra system prompt to append. */
  extraSystemPrompt?: string;
  /** Enable Claude Code hooks. */
  hooksEnabled?: boolean;
  /** Additional SDK options. */
  sdkOptions?: Record<string, unknown>;
  /** 3-tier model configuration (haiku/sonnet/opus). */
  modelTiers?: CcSdkModelTiers;
  /** Called for agent lifecycle events. */
  onAgentEvent?: (evt: { stream: string; data: Record<string, unknown> }) => void;
};

/** SDK event types from the Claude Agent SDK. */
export type SdkEventType =
  | "assistant_message"
  | "tool_use"
  | "tool_result"
  | "error"
  | "done"
  | "thinking"
  | "text";

/** Base SDK event structure. */
export type SdkEvent = {
  type: SdkEventType;
  data?: unknown;
};

/** SDK text/content event. */
export type SdkTextEvent = SdkEvent & {
  type: "text" | "assistant_message";
  data: {
    text?: string;
    content?: string;
  };
};

/** SDK tool use event. */
export type SdkToolUseEvent = SdkEvent & {
  type: "tool_use";
  data: {
    name: string;
    input: Record<string, unknown>;
    id?: string;
  };
};

/** SDK tool result event. */
export type SdkToolResultEvent = SdkEvent & {
  type: "tool_result";
  data: {
    tool_use_id: string;
    content: string;
    is_error?: boolean;
  };
};

/** SDK error event. */
export type SdkErrorEvent = SdkEvent & {
  type: "error";
  data: {
    message: string;
    code?: string;
  };
};

/** SDK done event. */
export type SdkDoneEvent = SdkEvent & {
  type: "done";
  data?: {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
};
