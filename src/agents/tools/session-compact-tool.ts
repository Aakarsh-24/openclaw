import { Type } from "@sinclair/typebox";
import {
  abortEmbeddedPiRun,
  compactEmbeddedPiSession,
  isEmbeddedPiRunActive,
  waitForEmbeddedPiRunEnd,
} from "../../agents/pi-embedded.js";
import { resolveAgentDir } from "../../agents/agent-scope.js";
import { loadConfig } from "../../config/config.js";
import {
  loadSessionStore,
  resolveSessionFilePath,
  resolveStorePath,
  updateSessionStore,
} from "../../config/sessions.js";
import { resolveAgentIdFromSessionKey, DEFAULT_AGENT_ID } from "../../routing/session-key.js";
import { formatContextUsageShort, formatTokenCount } from "../../auto-reply/status.js";
import { incrementCompactionCount } from "../../auto-reply/reply/session-updates.js";
import type { AnyAgentTool } from "./common.js";
import { readStringParam } from "./common.js";
import {
  resolveInternalSessionKey,
  resolveMainSessionAlias,
  createAgentToAgentPolicy,
} from "./sessions-helpers.js";
import { resolveDefaultModelForAgent } from "../../agents/model-selection.js";

const SessionCompactToolSchema = Type.Object({
  instructions: Type.Optional(
    Type.String({
      description:
        "Optional instructions for what to focus on during compaction (e.g., 'Focus on decisions and open tasks')",
    }),
  ),
});

interface SessionCompactToolOpts {
  config?: ReturnType<typeof loadConfig>;
  agentSessionKey?: string;
  workspaceDir?: string;
  thinkLevel?: string;
}

export function createSessionCompactTool(opts?: SessionCompactToolOpts): AnyAgentTool {
  return {
    label: "Session Compact",
    name: "session_compact",
    description:
      "Compact the current session's context to free up token space. Use when context is above 60% to proactively manage memory. The compaction summarizes older conversation history while preserving recent messages. After compaction, read your latest compaction file from memory/compactions/ to restore state.",
    parameters: SessionCompactToolSchema,
    execute: async (_toolCallId, args) => {
      const params = args as { instructions?: string };
      const cfg = opts?.config ?? loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);

      const sessionKey = opts?.agentSessionKey;
      if (!sessionKey) {
        throw new Error("sessionKey required for compaction");
      }

      const agentId = resolveAgentIdFromSessionKey(sessionKey) || DEFAULT_AGENT_ID;
      const storePath = resolveStorePath(cfg.session?.store, { agentId });
      const store = loadSessionStore(storePath);

      // Resolve the session entry
      const internalKey = resolveInternalSessionKey({
        key: sessionKey,
        alias,
        mainKey,
      });
      const entry = store[sessionKey] ?? store[internalKey];

      if (!entry?.sessionId) {
        return {
          content: [{ type: "text", text: "⚙️ Compaction unavailable (missing session id)." }],
          details: { ok: false, reason: "no sessionId" },
        };
      }

      const sessionId = entry.sessionId;

      // Abort any active run before compacting
      if (isEmbeddedPiRunActive(sessionId)) {
        abortEmbeddedPiRun(sessionId);
        await waitForEmbeddedPiRunEnd(sessionId, 15_000);
      }

      const configured = resolveDefaultModelForAgent({ cfg, agentId });
      const workspaceDir = opts?.workspaceDir ?? resolveAgentDir(cfg, agentId);

      const result = await compactEmbeddedPiSession({
        sessionId,
        sessionKey,
        messageChannel: entry.lastChannel ?? entry.channel ?? "unknown",
        groupId: entry.groupId,
        groupChannel: entry.groupChannel,
        groupSpace: entry.space,
        spawnedBy: entry.spawnedBy,
        sessionFile: resolveSessionFilePath(sessionId, entry),
        workspaceDir,
        config: cfg,
        skillsSnapshot: entry.skillsSnapshot,
        provider: entry.providerOverride ?? configured.provider,
        model: entry.modelOverride ?? configured.model,
        thinkLevel: (opts?.thinkLevel ?? cfg.agents?.defaults?.thinkingDefault ?? "medium") as any,
        bashElevated: {
          enabled: false,
          allowed: false,
          defaultLevel: "off",
        },
        customInstructions: params.instructions,
      });

      const compactLabel = result.ok
        ? result.compacted
          ? result.result?.tokensBefore != null && result.result?.tokensAfter != null
            ? `Compacted (${formatTokenCount(result.result.tokensBefore)} → ${formatTokenCount(result.result.tokensAfter)})`
            : result.result?.tokensBefore
              ? `Compacted (${formatTokenCount(result.result.tokensBefore)} before)`
              : "Compacted"
          : "Compaction skipped"
        : "Compaction failed";

      if (result.ok && result.compacted) {
        await incrementCompactionCount({
          sessionEntry: entry,
          sessionStore: store,
          sessionKey,
          storePath,
          tokensAfter: result.result?.tokensAfter,
        });
      }

      const tokensAfterCompaction = result.result?.tokensAfter;
      const totalTokens =
        tokensAfterCompaction ??
        entry.totalTokens ??
        (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0);
      const contextSummary = formatContextUsageShort(
        totalTokens > 0 ? totalTokens : null,
        entry.contextTokens ?? null,
      );

      const reason = result.reason?.trim();
      const line = reason
        ? `${compactLabel}: ${reason} • ${contextSummary}`
        : `${compactLabel} • ${contextSummary}`;

      return {
        content: [
          {
            type: "text",
            text: `🧹 ${line}\n\nNext: Read your latest file from memory/compactions/ to restore context state.`,
          },
        ],
        details: {
          ok: result.ok,
          compacted: result.compacted,
          tokensBefore: result.result?.tokensBefore,
          tokensAfter: result.result?.tokensAfter,
          reason: result.reason,
        },
      };
    },
  };
}
