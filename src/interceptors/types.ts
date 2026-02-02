import type { AgentToolResult } from "@mariozechner/pi-agent-core";

export type InterceptorName = "tool.before" | "tool.after" | "message.before" | "params.before";

/**
 * Known normalized tool names from tool-policy.ts.
 * Used for toolMatcher validation — interceptors targeting unknown tools
 * will throw at registration time instead of failing silently.
 */
export const KNOWN_TOOL_NAMES = new Set([
  // group:fs
  "read",
  "write",
  "edit",
  "apply_patch",
  // group:runtime
  "exec",
  "process",
  // group:memory
  "memory_search",
  "memory_get",
  // group:web
  "web_search",
  "web_fetch",
  // group:sessions
  "sessions_list",
  "sessions_history",
  "sessions_send",
  "sessions_spawn",
  "session_status",
  // group:ui
  "browser",
  "canvas",
  // group:automation
  "cron",
  "gateway",
  // group:messaging
  "message",
  // group:nodes
  "nodes",
  // openclaw native
  "agents_list",
  "image",
  "tts",
]);

export type ToolBeforeInput = {
  toolName: string;
  toolCallId: string;
};

export type ToolBeforeOutput = {
  args: Record<string, unknown>;
  block?: boolean;
  blockReason?: string;
};

export type ToolAfterInput = {
  toolName: string;
  toolCallId: string;
  isError: boolean;
};

export type ToolAfterOutput = {
  result: AgentToolResult<unknown>;
};

export type MessageBeforeInput = {
  agentId: string;
  sessionKey?: string;
  provider: string;
  model: string;
};

export type MessageBeforeOutput = {
  message: string;
  metadata: Record<string, unknown>;
};

export type ParamsBeforeInput = {
  agentId: string;
  sessionKey?: string;
  message: string;
  metadata: Record<string, unknown>;
};

export type ParamsBeforeOutput = {
  provider: string;
  model: string;
  thinkLevel?: string;
  reasoningLevel?: string;
  temperature?: number;
};

export type InterceptorInputMap = {
  "tool.before": ToolBeforeInput;
  "tool.after": ToolAfterInput;
  "message.before": MessageBeforeInput;
  "params.before": ParamsBeforeInput;
};

export type InterceptorOutputMap = {
  "tool.before": ToolBeforeOutput;
  "tool.after": ToolAfterOutput;
  "message.before": MessageBeforeOutput;
  "params.before": ParamsBeforeOutput;
};

export type InterceptorHandler<I, O> = (input: Readonly<I>, output: O) => Promise<void> | void;

export type InterceptorRegistration<N extends InterceptorName = InterceptorName> = {
  id: string;
  name: N;
  handler: InterceptorHandler<InterceptorInputMap[N], InterceptorOutputMap[N]>;
  priority?: number;
  toolMatcher?: RegExp;
  agentMatcher?: RegExp;
};

export type InterceptorEvent = {
  name: InterceptorName;
  interceptorId: string;
  matchContext?: string;
  blocked?: boolean;
  blockReason?: string;
  mutations?: string[];
};

export type InterceptorEventCallback = (event: InterceptorEvent) => void;
