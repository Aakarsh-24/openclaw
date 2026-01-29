import type { MoltbotConfig } from "../../config/config.js";
import type { OrchestratorConfig } from "../../config/types.orchestrator.js";

export const ORCHESTRATOR_DEFAULT_MODEL = "google-gemini-cli/gemini-3-flash-preview";

export function resolveOrchestratorConfig(config?: MoltbotConfig): OrchestratorConfig {
  const orchestrator = config?.orchestrator ?? {};

  return {
    enabled: orchestrator.enabled ?? false,
    model: orchestrator.model ?? ORCHESTRATOR_DEFAULT_MODEL,
    fallbacks: orchestrator.fallbacks ?? [],
    agents: {
      opencode: {
        enabled: orchestrator.agents?.opencode?.enabled ?? true,
        model: orchestrator.agents?.opencode?.model,
        mode: orchestrator.agents?.opencode?.mode ?? "cli",
        binary: orchestrator.agents?.opencode?.binary ?? "opencode",
        timeoutMs: orchestrator.agents?.opencode?.timeoutMs ?? 300000,
        servePort: orchestrator.agents?.opencode?.servePort ?? 4096,
      },
      research: {
        enabled: orchestrator.agents?.research?.enabled ?? true,
        model: orchestrator.agents?.research?.model,
      },
      embedded: {
        enabled: orchestrator.agents?.embedded?.enabled ?? true,
        model: orchestrator.agents?.embedded?.model,
      },
    },
    parallelExecution: orchestrator.parallelExecution ?? true,
    maxParallelAgents: orchestrator.maxParallelAgents ?? 3,
  };
}
