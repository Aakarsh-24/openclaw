export interface OpenCodeAgentConfig {
  enabled?: boolean;
  model?: string;
  mode?: "cli" | "serve";
  binary?: string;
  timeoutMs?: number;
  servePort?: number;
}

export interface ResearchAgentConfig {
  enabled?: boolean;
  model?: string;
}

export interface EmbeddedAgentConfig {
  enabled?: boolean;
  model?: string | null;
}

export interface OrchestratorConfig {
  enabled?: boolean;
  model?: string;
  fallbacks?: string[];
  agents?: {
    opencode?: OpenCodeAgentConfig;
    research?: ResearchAgentConfig;
    embedded?: EmbeddedAgentConfig;
  };
  parallelExecution?: boolean;
  maxParallelAgents?: number;
}
