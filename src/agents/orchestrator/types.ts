import type { ImageContent } from "@mariozechner/pi-ai";
import type { ThinkLevel } from "../../auto-reply/thinking.js";
import type { MoltbotConfig } from "../../config/config.js";
import type { OrchestratorConfig } from "../../config/types.orchestrator.js";

export type {
  OrchestratorConfig,
  OpenCodeAgentConfig,
  ResearchAgentConfig,
  EmbeddedAgentConfig,
} from "../../config/types.orchestrator.js";

export interface AgentResult {
  agentName: string;
  agentType: "opencode" | "research" | "embedded" | "orchestrator";
  status: "success" | "error" | "partial" | "timeout";
  output: string;
  artifacts?: unknown[];
  errorMessage?: string;
  durationMs: number;
  model?: string;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

export interface OrchestratorParams {
  userMessage: string;
  sessionId: string;
  sessionKey?: string;
  config?: MoltbotConfig;
  images?: ImageContent[];
  timeoutMs?: number;
  thinking?: ThinkLevel;
}

export interface OrchestratorResponse {
  payloads: Array<{ text: string; isError?: boolean }>;
  agentResults: AgentResult[];
  meta: {
    durationMs: number;
    orchestratorModel: string;
    delegatedAgents: string[];
  };
}
