/**
 * Agent runtime abstraction layer.
 *
 * Defines the common interface for agent execution backends (Pi Agent, Claude Agent SDK, etc.).
 */

import type { ImageContent } from "@mariozechner/pi-ai";
import type { MoltbotConfig } from "../config/config.js";
import type { AgentStreamParams } from "../commands/agent/types.js";
import type { ThinkLevel, VerboseLevel } from "../auto-reply/thinking.js";
import type { SkillSnapshot } from "./skills.js";
import type { EmbeddedPiRunResult } from "./pi-embedded-runner/types.js";

/** Agent runtime backend discriminant. */
export type AgentRuntimeKind = "pi" | "ccsdk";

/** Result type shared by all agent runtimes. */
export type AgentRuntimeResult = EmbeddedPiRunResult;

/** Streaming and event callbacks for agent runs. */
export type AgentRuntimeCallbacks = {
  /** Called when a partial reply chunk is available. */
  onPartialReply?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  /** Called when the assistant message starts. */
  onAssistantMessageStart?: () => void | Promise<void>;
  /** Called for block-level reply delivery. */
  onBlockReply?: (payload: {
    text?: string;
    mediaUrls?: string[];
    audioAsVoice?: boolean;
    replyToId?: string;
    replyToTag?: boolean;
    replyToCurrent?: boolean;
  }) => void | Promise<void>;
  /** Called when block replies should be flushed. */
  onBlockReplyFlush?: () => void | Promise<void>;
  /** Called for reasoning/thinking stream events. */
  onReasoningStream?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  /** Called when a tool result is available. */
  onToolResult?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  /** Called for agent lifecycle and internal events. */
  onAgentEvent?: (evt: { stream: string; data: Record<string, unknown> }) => void;
};

/** Common parameters for agent run invocations. */
export type AgentRuntimeRunParams = {
  sessionId: string;
  sessionKey?: string;
  sessionFile: string;
  workspaceDir: string;
  agentDir?: string;
  config?: MoltbotConfig;
  skillsSnapshot?: SkillSnapshot;
  prompt: string;
  images?: ImageContent[];
  provider?: string;
  model?: string;
  authProfileId?: string;
  authProfileIdSource?: "auto" | "user";
  thinkLevel?: ThinkLevel;
  verboseLevel?: VerboseLevel;
  timeoutMs: number;
  runId: string;
  lane?: string;
  abortSignal?: AbortSignal;
  extraSystemPrompt?: string;
  streamParams?: AgentStreamParams;
  /** Messaging context for delivery routing. */
  messageChannel?: string;
  agentAccountId?: string;
  messageTo?: string;
  messageThreadId?: string | number;
  groupId?: string | null;
  groupChannel?: string | null;
  groupSpace?: string | null;
  spawnedBy?: string | null;
  currentChannelId?: string;
  currentThreadTs?: string;
  replyToMode?: "off" | "first" | "all";
  hasRepliedRef?: { value: boolean };
} & AgentRuntimeCallbacks;

/**
 * Agent runtime interface.
 *
 * Defines the contract for executing agent turns across different backends.
 */
export interface AgentRuntime {
  /** Runtime backend discriminant. */
  readonly kind: AgentRuntimeKind;
  /** Human-readable display name for the runtime. */
  readonly displayName: string;
  /** Execute an agent turn with the given parameters. */
  run(params: AgentRuntimeRunParams): Promise<AgentRuntimeResult>;
}
