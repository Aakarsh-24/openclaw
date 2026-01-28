/**
 * Claude Agent SDK runtime implementation.
 *
 * Implements the AgentRuntime interface using the Claude Agent SDK for execution.
 */

import type { MoltbotConfig } from "../../config/config.js";
import type { AgentRuntime, AgentRuntimeRunParams, AgentRuntimeResult } from "../agent-runtime.js";
import type { AgentCcSdkConfig } from "../../config/types.agents.js";
import { runSdkAgent } from "./sdk-runner.js";
import { resolveProviderConfig } from "./provider-config.js";
import { isSdkAvailable } from "./sdk-loader.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("agents/claude-agent-sdk");

export type CcSdkAgentRuntimeContext = {
  /** Moltbot configuration. */
  config?: MoltbotConfig;
  /** Claude Code SDK configuration. */
  ccsdkConfig?: AgentCcSdkConfig;
  /** Explicit API key override. */
  apiKey?: string;
  /** Explicit auth token override (for subscription auth). */
  authToken?: string;
  /** Custom base URL for API requests. */
  baseUrl?: string;
};

/**
 * Create a Claude Code SDK runtime instance.
 *
 * The CCSDK runtime uses the Claude Agent SDK for model execution,
 * which supports:
 * - Claude Code CLI authentication (subscription-based)
 * - Anthropic API key authentication
 * - AWS Bedrock and Google Vertex AI backends
 */
export function createCcSdkAgentRuntime(context?: CcSdkAgentRuntimeContext): AgentRuntime {
  // Pre-check SDK availability
  if (!isSdkAvailable()) {
    log.warn("Claude Agent SDK not available - runtime will fail on first run");
  }

  // Resolve provider configuration from context
  const providerConfig = resolveProviderConfig({
    apiKey: context?.apiKey,
    authToken: context?.authToken,
    baseUrl: context?.baseUrl,
    useCliCredentials: true, // Enable Claude CLI credential resolution
  });

  return {
    kind: "ccsdk",
    displayName: `Claude Code SDK (${providerConfig.name})`,

    async run(params: AgentRuntimeRunParams): Promise<AgentRuntimeResult> {
      log.debug("CCSDK runtime run", {
        sessionId: params.sessionId,
        runId: params.runId,
        provider: providerConfig.name,
      });

      return runSdkAgent({
        sessionId: params.sessionId,
        sessionKey: params.sessionKey,
        sessionFile: params.sessionFile,
        workspaceDir: params.workspaceDir,
        agentDir: params.agentDir,
        config: params.config ?? context?.config,
        prompt: params.prompt,
        model: params.model ? `${params.provider}/${params.model}` : undefined,
        providerConfig,
        timeoutMs: params.timeoutMs,
        runId: params.runId,
        abortSignal: params.abortSignal,
        extraSystemPrompt: params.extraSystemPrompt,
        hooksEnabled: context?.ccsdkConfig?.hooksEnabled,
        sdkOptions: context?.ccsdkConfig?.options,
        modelTiers: context?.ccsdkConfig?.models,
        onAgentEvent: params.onAgentEvent,
      });
    },
  };
}
