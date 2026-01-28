/**
 * Pi Agent runtime implementation.
 *
 * Wraps the existing runEmbeddedPiAgent function to conform to the AgentRuntime interface.
 */

import type { AgentRuntime, AgentRuntimeRunParams, AgentRuntimeResult } from "./agent-runtime.js";
import { runEmbeddedPiAgent } from "./pi-embedded.js";

/**
 * Create a Pi Agent runtime instance.
 *
 * The Pi Agent runtime is the default backend that uses the Pi AI SDK
 * for model execution with moltbot's tool system.
 */
export function createPiAgentRuntime(): AgentRuntime {
  return {
    kind: "pi",
    displayName: "Pi Agent",

    async run(params: AgentRuntimeRunParams): Promise<AgentRuntimeResult> {
      return runEmbeddedPiAgent({
        sessionId: params.sessionId,
        sessionKey: params.sessionKey,
        sessionFile: params.sessionFile,
        workspaceDir: params.workspaceDir,
        agentDir: params.agentDir,
        config: params.config,
        skillsSnapshot: params.skillsSnapshot,
        prompt: params.prompt,
        images: params.images,
        provider: params.provider,
        model: params.model,
        authProfileId: params.authProfileId,
        authProfileIdSource: params.authProfileIdSource,
        thinkLevel: params.thinkLevel,
        verboseLevel: params.verboseLevel,
        timeoutMs: params.timeoutMs,
        runId: params.runId,
        lane: params.lane,
        abortSignal: params.abortSignal,
        extraSystemPrompt: params.extraSystemPrompt,
        streamParams: params.streamParams,
        // Messaging context
        messageChannel: params.messageChannel,
        agentAccountId: params.agentAccountId,
        messageTo: params.messageTo,
        messageThreadId: params.messageThreadId,
        groupId: params.groupId,
        groupChannel: params.groupChannel,
        groupSpace: params.groupSpace,
        spawnedBy: params.spawnedBy,
        currentChannelId: params.currentChannelId,
        currentThreadTs: params.currentThreadTs,
        replyToMode: params.replyToMode,
        hasRepliedRef: params.hasRepliedRef,
        // Callbacks
        onPartialReply: params.onPartialReply,
        onAssistantMessageStart: params.onAssistantMessageStart,
        onBlockReply: params.onBlockReply,
        onBlockReplyFlush: params.onBlockReplyFlush,
        onReasoningStream: params.onReasoningStream,
        onToolResult: params.onToolResult,
        onAgentEvent: params.onAgentEvent,
      });
    },
  };
}
