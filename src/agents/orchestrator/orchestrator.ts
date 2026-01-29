import { runEmbeddedPiAgent } from "../pi-embedded-runner/run.js";
import { resolveOrchestratorConfig } from "./config.js";
import { buildOrchestratorSystemPrompt } from "./prompt.js";
import { createDelegationTools } from "./delegation-tools/tools.js";
import { aggregateResults } from "./result-aggregator.js";
import type { OrchestratorParams, OrchestratorResponse, AgentResult } from "./types.js";
import { resolveSessionTranscriptPath } from "../../config/sessions/paths.js";

export async function orchestrateUserMessage(
  params: OrchestratorParams,
): Promise<OrchestratorResponse> {
  const started = Date.now();
  const orchestratorConfig = resolveOrchestratorConfig(params.config);

  if (!orchestratorConfig.enabled) {
    const result = await runEmbeddedPiAgent({
      sessionId: params.sessionId,
      sessionKey: params.sessionKey,
      sessionFile: resolveSessionTranscriptPath(params.sessionId),
      workspaceDir: params.config?.agents?.defaults?.workspace ?? process.cwd(),
      config: params.config,
      prompt: params.userMessage,
      timeoutMs: params.timeoutMs ?? 300000,
      runId: `direct-${Date.now()}`,
      images: params.images,
      thinkLevel: params.thinking,
    });

    const output = (result.payloads ?? [])
      .filter((p): p is { text: string } => !p.isError && typeof p.text === "string")
      .map((p) => p.text)
      .join("\n")
      .trim();

    const errorPayload = (result.payloads ?? []).find((p) => p.isError);

    return {
      payloads: (result.payloads ?? []).map((p) => ({ text: p.text ?? "", isError: p.isError })),
      agentResults: [
        {
          agentName: "Moltbot",
          agentType: "embedded",
          status: errorPayload ? "error" : "success",
          output,
          errorMessage: errorPayload?.text,
          durationMs: Date.now() - started,
        },
      ],
      meta: {
        durationMs: Date.now() - started,
        orchestratorModel: "disabled",
        delegatedAgents: ["embedded"],
      },
    };
  }

  const agentResults: AgentResult[] = [];
  const onAgentResult = (result: AgentResult) => {
    agentResults.push(result);
  };

  const tools = createDelegationTools({
    config: params.config!,
    orchestratorConfig,
    sessionId: params.sessionId,
    sessionKey: params.sessionKey,
    onAgentResult,
  });

  const systemPrompt = buildOrchestratorSystemPrompt(orchestratorConfig);
  const modelRef = orchestratorConfig.model || "google/gemini-3-flash-preview";

  const orchestratorRunResult = await runEmbeddedPiAgent({
    sessionId: `orch-${params.sessionId}`,
    sessionKey: params.sessionKey ? `orch-${params.sessionKey}` : undefined,
    sessionFile: resolveSessionTranscriptPath(`orch-${params.sessionId}`),
    workspaceDir: params.config?.agents?.defaults?.workspace ?? process.cwd(),
    config: params.config,
    prompt: params.userMessage,
    timeoutMs: params.timeoutMs ?? 300000,
    runId: `orch-run-${Date.now()}`,
    provider: modelRef.split("/")[0],
    model: modelRef.split("/").slice(1).join("/"),
    extraSystemPrompt: systemPrompt,
    extraTools: tools,
    disableTools: false,
    images: params.images,
  });

  const orchestratorText = (orchestratorRunResult.payloads ?? [])
    .filter((p): p is { text: string } => !p.isError && typeof p.text === "string")
    .map((p) => p.text)
    .join("\n")
    .trim();

  if (orchestratorText && agentResults.length === 0) {
    agentResults.push({
      agentName: "Orchestrator",
      agentType: "orchestrator",
      status: "success",
      output: orchestratorText,
      durationMs: Date.now() - started,
      model: modelRef,
    });
  }

  return aggregateResults(agentResults, modelRef);
}
