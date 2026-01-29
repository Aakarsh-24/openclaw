import { runEmbeddedPiAgent } from "../../pi-embedded-runner/run.js";
import type { AgentResult, EmbeddedAgentConfig } from "../types.js";
import type { MoltbotConfig } from "../../../config/config.js";
import { resolveSessionTranscriptPath } from "../../../config/sessions/paths.js";

export async function delegateToEmbeddedAgent(
  message: string,
  options: EmbeddedAgentConfig,
  config?: MoltbotConfig,
  sessionId?: string,
  sessionKey?: string,
): Promise<AgentResult> {
  const started = Date.now();
  const effectiveSessionId = sessionId ?? `orchestrator-sub-${Date.now()}`;

  try {
    const result = await runEmbeddedPiAgent({
      sessionId: effectiveSessionId,
      sessionKey,
      sessionFile: resolveSessionTranscriptPath(effectiveSessionId),
      workspaceDir: config?.agents?.defaults?.workspace ?? process.cwd(),
      config,
      prompt: message,
      timeoutMs: 300000,
      runId: `orchestrator-${Date.now()}`,
      provider: options.model ? options.model.split("/")[0] : undefined,
      model: options.model ? options.model.split("/").slice(1).join("/") : undefined,
      disableTools: false, // Allow embedded agent to use its tools
    });

    const output = (result.payloads ?? [])
      .filter((p): p is { text: string } => !p.isError && typeof p.text === "string")
      .map((p) => p.text)
      .join("\n")
      .trim();

    const errorPayload = (result.payloads ?? []).find((p) => p.isError);

    return {
      agentName: "Moltbot",
      agentType: "embedded",
      status: errorPayload ? "error" : "success",
      output,
      errorMessage: errorPayload?.text,
      durationMs: Date.now() - started,
      model: options.model ?? undefined,
    };
  } catch (error: any) {
    return {
      agentName: "Moltbot",
      agentType: "embedded",
      status: "error",
      output: "",
      errorMessage: error.message || "Failed to execute embedded agent",
      durationMs: Date.now() - started,
      model: options.model ?? undefined,
    };
  }
}
