import type { AgentResult, OrchestratorResponse } from "./types.js";

export function aggregateResults(
  results: AgentResult[],
  orchestratorModel: string,
): OrchestratorResponse {
  const payloads: Array<{ text: string; isError?: boolean }> = [];

  for (const result of results) {
    if (result.status === "error") {
      payloads.push({
        text: `**${result.agentName} Error:**\n${result.errorMessage || result.output}`,
        isError: true,
      });
    } else {
      payloads.push({
        text: results.length > 1 ? `**${result.agentName}:**\n${result.output}` : result.output,
      });
    }
  }

  return {
    payloads,
    agentResults: results,
    meta: {
      durationMs: results.length > 0 ? Math.max(...results.map((r) => r.durationMs)) : 0,
      orchestratorModel,
      delegatedAgents: results.map((r) => r.agentType),
    },
  };
}
