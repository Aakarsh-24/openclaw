/**
 * Claude Agent SDK runner.
 *
 * Executes agent turns using the Claude Agent SDK, handling authentication,
 * event streaming, and result adaptation.
 */

import type { SdkRunnerParams, SdkProviderEnv } from "./types.js";
import type { CcSdkModelTiers } from "../../config/types.agents.js";
import type { AgentRuntimeResult } from "../agent-runtime.js";
import { loadClaudeAgentSdk, type ClaudeAgentSdkModule } from "./sdk-loader.js";
import { resolveProviderConfig } from "./provider-config.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("agents/claude-agent-sdk");

/**
 * Build environment variables for model tier configuration.
 *
 * The Claude Code SDK uses these environment variables to select models
 * for different task complexity tiers.
 */
function buildModelTierEnv(modelTiers?: CcSdkModelTiers): SdkProviderEnv {
  const env: SdkProviderEnv = {};

  if (modelTiers?.haiku) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = modelTiers.haiku;
  }
  if (modelTiers?.sonnet) {
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = modelTiers.sonnet;
  }
  if (modelTiers?.opus) {
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = modelTiers.opus;
  }

  return env;
}

/**
 * Run an agent turn using the Claude Agent SDK.
 *
 * This function:
 * 1. Loads the SDK dynamically
 * 2. Configures authentication based on available credentials
 * 3. Executes the agent turn with the given prompt
 * 4. Streams events back to the caller
 * 5. Returns results in the standard AgentRuntimeResult format
 */
export async function runSdkAgent(params: SdkRunnerParams): Promise<AgentRuntimeResult> {
  const started = Date.now();

  // Emit lifecycle start event
  params.onAgentEvent?.({
    stream: "lifecycle",
    data: {
      phase: "start",
      runtime: "sdk",
      sessionId: params.sessionId,
      runId: params.runId,
    },
  });

  try {
    // Load the SDK
    const sdk = await loadClaudeAgentSdk();

    // Resolve provider configuration
    const providerConfig = params.providerConfig ?? resolveProviderConfig();

    log.info("Starting SDK agent run", {
      provider: providerConfig.name,
      model: params.model,
      sessionId: params.sessionId,
      runId: params.runId,
    });

    // Set up environment for the SDK
    const originalEnv = { ...process.env };
    try {
      // Apply provider environment variables
      for (const [key, value] of Object.entries(providerConfig.env)) {
        if (value !== undefined) {
          process.env[key] = value;
        }
      }

      // Apply model tier environment variables
      const modelTierEnv = buildModelTierEnv(params.modelTiers);
      for (const [key, value] of Object.entries(modelTierEnv)) {
        if (value !== undefined) {
          process.env[key] = value;
        }
      }

      // Build SDK options
      const sdkOptions = {
        model: params.model,
        workingDirectory: params.workspaceDir,
        systemPrompt: params.extraSystemPrompt,
        timeout: params.timeoutMs,
        signal: params.abortSignal,
        ...params.sdkOptions,
      };

      // Run the agent
      // Note: The actual SDK API may differ - this is a placeholder implementation
      // that will need to be updated based on the actual SDK interface
      const result = await runSdkAgentInternal(sdk, params.prompt, sdkOptions, {
        onEvent: (event) => {
          // Forward events to the caller
          params.onAgentEvent?.({
            stream: "sdk",
            data: event as Record<string, unknown>,
          });
        },
      });

      // Build result
      const agentResult: AgentRuntimeResult = {
        payloads: result.texts.map((text) => ({ text })),
        meta: {
          durationMs: Date.now() - started,
          agentMeta: {
            sessionId: params.sessionId,
            provider: "anthropic",
            model: params.model ?? "claude-sonnet-4-20250514",
            usage: result.usage,
          },
          aborted: result.aborted,
        },
      };

      // Emit lifecycle end event
      params.onAgentEvent?.({
        stream: "lifecycle",
        data: {
          phase: "end",
          runtime: "sdk",
          startedAt: started,
          endedAt: Date.now(),
          aborted: result.aborted ?? false,
        },
      });

      return agentResult;
    } finally {
      // Restore original environment
      const keysToRestore = [
        ...Object.keys(providerConfig.env),
        ...Object.keys(buildModelTierEnv(params.modelTiers)),
      ];
      for (const key of keysToRestore) {
        if (originalEnv[key] !== undefined) {
          process.env[key] = originalEnv[key];
        } else {
          delete process.env[key];
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error("SDK agent run failed", {
      error: errorMessage,
      sessionId: params.sessionId,
      runId: params.runId,
    });

    // Emit lifecycle error event
    params.onAgentEvent?.({
      stream: "lifecycle",
      data: {
        phase: "error",
        runtime: "sdk",
        startedAt: started,
        endedAt: Date.now(),
        error: errorMessage,
      },
    });

    // Return error result
    return {
      payloads: [
        {
          text: `SDK agent error: ${errorMessage}`,
          isError: true,
        },
      ],
      meta: {
        durationMs: Date.now() - started,
        agentMeta: {
          sessionId: params.sessionId,
          provider: "anthropic",
          model: params.model ?? "unknown",
        },
      },
    };
  }
}

/**
 * Internal SDK execution function.
 *
 * This is a placeholder that needs to be implemented based on the actual
 * Claude Agent SDK API. The SDK provides different interfaces for:
 * - Simple completions
 * - Agentic tool use
 * - Streaming responses
 */
async function runSdkAgentInternal(
  sdk: ClaudeAgentSdkModule,
  _prompt: string,
  options: {
    model?: string;
    workingDirectory?: string;
    systemPrompt?: string;
    timeout?: number;
    signal?: AbortSignal;
  },
  _callbacks: {
    onEvent?: (event: unknown) => void;
  },
): Promise<{
  texts: string[];
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  aborted?: boolean;
}> {
  // Placeholder implementation - needs to be updated based on actual SDK API
  // The SDK likely provides something like:
  // - sdk.createAgent() or sdk.Agent class
  // - agent.run(prompt) or agent.chat(prompt)
  // - Event streaming via async iterators or callbacks

  const texts: string[] = [];
  const usage:
    | {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
        total?: number;
      }
    | undefined = undefined;
  let aborted = false;

  try {
    // Check if SDK has the expected interface
    // This needs to be updated based on actual SDK API
    if ("Claude" in sdk || "createAgent" in sdk || "Agent" in sdk) {
      // TODO: Implement actual SDK call based on SDK's public API
      // For now, throw to indicate SDK integration is not yet complete
      throw new Error(
        "Claude Agent SDK integration not yet implemented. " +
          "Please check SDK documentation for the correct API.",
      );
    }

    // Fallback: check for simple completion API
    throw new Error("Unable to find compatible API in Claude Agent SDK");
  } catch (error) {
    if (options.signal?.aborted) {
      aborted = true;
      texts.push("Agent run was aborted.");
    } else {
      throw error;
    }
  }

  return { texts, usage, aborted };
}
