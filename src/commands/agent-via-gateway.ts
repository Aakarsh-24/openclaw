import type { CliDeps } from "../cli/deps.js";
import type { RuntimeEnv } from "../runtime.js";
import { listAgentIds } from "../agents/agent-scope.js";
import { DEFAULT_CHAT_CHANNEL } from "../channels/registry.js";
import { formatCliCommand } from "../cli/command-format.js";
import { withProgress, type ProgressReporter } from "../cli/progress.js";
import { loadConfig } from "../config/config.js";
import { callGateway, randomIdempotencyKey } from "../gateway/call.js";
import { normalizeAgentId } from "../routing/session-key.js";
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
  normalizeMessageChannel,
} from "../utils/message-channel.js";
import { type AgentEventPayload, onAgentEvent } from "../infra/agent-events.js";
import { formatAgentFeedbackLabel } from "../infra/agent-feedback.js";
import {
  normalizeFeedbackLevel,
  resolveFeedbackLevel,
  type FeedbackLevel,
} from "../infra/feedback.js";
import { agentCommand } from "./agent.js";
import { resolveSessionKeyForRequest } from "./agent/session.js";

type AgentGatewayResult = {
  payloads?: Array<{
    text?: string;
    mediaUrl?: string | null;
    mediaUrls?: string[];
  }>;
  meta?: unknown;
};

type GatewayAgentResponse = {
  runId?: string;
  status?: string;
  summary?: string;
  result?: AgentGatewayResult;
};

export type AgentCliOpts = {
  message: string;
  agent?: string;
  to?: string;
  sessionId?: string;
  thinking?: string;
  verbose?: string;
  feedback?: string;
  json?: boolean;
  timeout?: string;
  deliver?: boolean;
  channel?: string;
  replyTo?: string;
  replyChannel?: string;
  replyAccount?: string;
  bestEffortDeliver?: boolean;
  lane?: string;
  runId?: string;
  extraSystemPrompt?: string;
  local?: boolean;
};

function resolveCliFeedbackLevel(opts: AgentCliOpts, cfg: ReturnType<typeof loadConfig>) {
  const explicit = normalizeFeedbackLevel(opts.feedback);
  if (opts.feedback && !explicit) {
    throw new Error('Invalid feedback level. Use "silent", "info", or "debug".');
  }
  const configLevel = normalizeFeedbackLevel(cfg.ui?.feedback);
  return resolveFeedbackLevel(opts.feedback, configLevel);
}

function createFeedbackLabelUpdater(progress: ProgressReporter, level: FeedbackLevel) {
  if (level === "silent") {
    return (_label?: string) => {};
  }
  let lastLabel = "";
  return (label?: string) => {
    if (!label || label === lastLabel) {
      return;
    }
    lastLabel = label;
    progress.setLabel(label);
  };
}

function parseTimeoutSeconds(opts: { cfg: ReturnType<typeof loadConfig>; timeout?: string }) {
  const raw =
    opts.timeout !== undefined
      ? Number.parseInt(String(opts.timeout), 10)
      : (opts.cfg.agents?.defaults?.timeoutSeconds ?? 600);
  if (Number.isNaN(raw) || raw <= 0) {
    throw new Error("--timeout must be a positive integer (seconds)");
  }
  return raw;
}

function formatPayloadForLog(payload: {
  text?: string;
  mediaUrls?: string[];
  mediaUrl?: string | null;
}) {
  const lines: string[] = [];
  if (payload.text) {
    lines.push(payload.text.trimEnd());
  }
  const mediaUrl =
    typeof payload.mediaUrl === "string" && payload.mediaUrl.trim()
      ? payload.mediaUrl.trim()
      : undefined;
  const media = payload.mediaUrls ?? (mediaUrl ? [mediaUrl] : []);
  for (const url of media) {
    lines.push(`MEDIA:${url}`);
  }
  return lines.join("\n").trimEnd();
}

export async function agentViaGatewayCommand(opts: AgentCliOpts, runtime: RuntimeEnv) {
  const body = (opts.message ?? "").trim();
  if (!body) {
    throw new Error("Message (--message) is required");
  }
  if (!opts.to && !opts.sessionId && !opts.agent) {
    throw new Error("Pass --to <E.164>, --session-id, or --agent to choose a session");
  }

  const cfg = loadConfig();
  const agentIdRaw = opts.agent?.trim();
  const agentId = agentIdRaw ? normalizeAgentId(agentIdRaw) : undefined;
  if (agentId) {
    const knownAgents = listAgentIds(cfg);
    if (!knownAgents.includes(agentId)) {
      throw new Error(
        `Unknown agent id "${agentIdRaw}". Use "${formatCliCommand("openclaw agents list")}" to see configured agents.`,
      );
    }
  }
  const timeoutSeconds = parseTimeoutSeconds({ cfg, timeout: opts.timeout });
  const gatewayTimeoutMs = Math.max(10_000, (timeoutSeconds + 30) * 1000);
  const feedbackLevel = resolveCliFeedbackLevel(opts, cfg);

  const sessionKey = resolveSessionKeyForRequest({
    cfg,
    agentId,
    to: opts.to,
    sessionId: opts.sessionId,
  }).sessionKey;

  const channel = normalizeMessageChannel(opts.channel) ?? DEFAULT_CHAT_CHANNEL;
  const idempotencyKey = opts.runId?.trim() || randomIdempotencyKey();

  const response = await withProgress(
    {
      label: "Waiting for agent reply…",
      indeterminate: true,
      enabled: opts.json !== true,
    },
    async (progress) => {
      const updateLabel = createFeedbackLabelUpdater(progress, feedbackLevel);
      const handleAgentPayload = (payload: AgentEventPayload) => {
        if (payload.runId !== idempotencyKey) {
          return;
        }
        const label = formatAgentFeedbackLabel(payload, feedbackLevel);
        updateLabel(label);
      };
      return await callGateway<GatewayAgentResponse>({
        method: "agent",
        params: {
          message: body,
          agentId,
          to: opts.to,
          replyTo: opts.replyTo,
          sessionId: opts.sessionId,
          sessionKey,
          thinking: opts.thinking,
          feedback: feedbackLevel === "silent" ? undefined : feedbackLevel,
          deliver: Boolean(opts.deliver),
          channel,
          replyChannel: opts.replyChannel,
          replyAccountId: opts.replyAccount,
          timeout: timeoutSeconds,
          lane: opts.lane,
          extraSystemPrompt: opts.extraSystemPrompt,
          idempotencyKey,
        },
        expectFinal: true,
        timeoutMs: gatewayTimeoutMs,
        clientName: GATEWAY_CLIENT_NAMES.CLI,
        mode: GATEWAY_CLIENT_MODES.CLI,
        onEvent: (evt) => {
          if (!evt || evt.event !== "agent" || feedbackLevel === "silent") {
            return;
          }
          const payload = evt.payload as AgentEventPayload;
          if (payload && typeof payload === "object") {
            handleAgentPayload(payload);
          }
        },
      });
    },
  );

  if (opts.json) {
    runtime.log(JSON.stringify(response, null, 2));
    return response;
  }

  const result = response?.result;
  const payloads = result?.payloads ?? [];

  if (payloads.length === 0) {
    runtime.log(response?.summary ? String(response.summary) : "No reply from agent.");
    return response;
  }

  for (const payload of payloads) {
    const out = formatPayloadForLog(payload);
    if (out) {
      runtime.log(out);
    }
  }

  return response;
}

export async function agentCliCommand(opts: AgentCliOpts, runtime: RuntimeEnv, deps?: CliDeps) {
  const cfg = loadConfig();
  const feedbackLevel = resolveCliFeedbackLevel(opts, cfg);
  const runId = opts.runId?.trim() || randomIdempotencyKey();
  const localOpts = {
    ...opts,
    agentId: opts.agent,
    replyAccountId: opts.replyAccount,
    runId,
  };
  if (opts.local === true) {
    return await withProgress(
      {
        label: "Waiting for agent reply…",
        indeterminate: true,
        enabled: opts.json !== true,
      },
      async (progress) => {
        const updateLabel = createFeedbackLabelUpdater(progress, feedbackLevel);
        const stop = onAgentEvent((evt) => {
          if (evt.runId !== runId) {
            return;
          }
          const label = formatAgentFeedbackLabel(evt, feedbackLevel);
          updateLabel(label);
        });
        try {
          return await agentCommand(localOpts, runtime, deps);
        } finally {
          stop();
        }
      },
    );
  }

  try {
    return await agentViaGatewayCommand(opts, runtime);
  } catch (err) {
    runtime.error?.(`Gateway agent failed; falling back to embedded: ${String(err)}`);
    return await withProgress(
      {
        label: "Waiting for agent reply…",
        indeterminate: true,
        enabled: opts.json !== true,
      },
      async (progress) => {
        const updateLabel = createFeedbackLabelUpdater(progress, feedbackLevel);
        const stop = onAgentEvent((evt) => {
          if (evt.runId !== runId) {
            return;
          }
          const label = formatAgentFeedbackLabel(evt, feedbackLevel);
          updateLabel(label);
        });
        try {
          return await agentCommand(localOpts, runtime, deps);
        } finally {
          stop();
        }
      },
    );
  }
}
