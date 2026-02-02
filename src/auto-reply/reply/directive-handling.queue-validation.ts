import type { OpenClawConfig } from "../../config/config.js";
import type { SessionEntry } from "../../config/sessions.js";
import type { ReplyPayload } from "../types.js";
import type { InlineDirectives } from "./directive-handling.parse.js";
import { withOptions } from "./directive-handling.shared.js";
import { resolveQueueSettings } from "./queue.js";
import { getFollowupQueueDepth } from "./queue.js";

export function maybeHandleQueueDirective(params: {
  directives: InlineDirectives;
  cfg: OpenClawConfig;
  channel: string;
  sessionEntry?: SessionEntry;
}): ReplyPayload | undefined {
  const { directives } = params;
  if (!directives.hasQueueDirective) {
    return undefined;
  }

  const wantsStatus =
    !directives.queueMode &&
    !directives.queueReset &&
    !directives.hasQueueOptions &&
    directives.rawQueueMode === undefined &&
    directives.rawDebounce === undefined &&
    directives.rawCap === undefined &&
    directives.rawDrop === undefined;
  if (wantsStatus) {
    const settings = resolveQueueSettings({
      cfg: params.cfg,
      channel: params.channel,
      sessionEntry: params.sessionEntry,
    });
    const debounceLabel =
      typeof settings.debounceMs === "number" ? `${settings.debounceMs}ms` : "default";
    const capLabel = typeof settings.cap === "number" ? String(settings.cap) : "default";
    const dropLabel = settings.dropPolicy ?? "default";

    // Followup queues are keyed by the same string used in enqueue APIs.
    // SessionEntry.sessionId is the session key string for the current conversation.
    const sessionKey = params.sessionEntry?.sessionId;
    const depth = sessionKey ? getFollowupQueueDepth(sessionKey) : 0;

    // Treat explicit 0 values as overrides (e.g., debounce=0).
    const overrides = Boolean(
      params.sessionEntry &&
      (params.sessionEntry.queueDebounceMs !== undefined ||
        params.sessionEntry.queueCap !== undefined ||
        params.sessionEntry.queueDrop !== undefined),
    );

    const lines = [
      "🧵 Queue (current session)",
      `mode=${settings.mode}${overrides ? " (overrides)" : ""}`,
      `debounce=${debounceLabel} · cap=${capLabel} · drop=${dropLabel}`,
      `followup_depth=${depth}`,
    ];

    return {
      text: withOptions(
        lines.join("\n"),
        "modes steer, followup, collect, steer+backlog, interrupt; debounce:<ms|s|m>, cap:<n>, drop:old|new|summarize",
      ),
    };
  }

  const queueModeInvalid =
    !directives.queueMode && !directives.queueReset && Boolean(directives.rawQueueMode);
  const queueDebounceInvalid =
    directives.rawDebounce !== undefined && typeof directives.debounceMs !== "number";
  const queueCapInvalid = directives.rawCap !== undefined && typeof directives.cap !== "number";
  const queueDropInvalid = directives.rawDrop !== undefined && !directives.dropPolicy;

  if (queueModeInvalid || queueDebounceInvalid || queueCapInvalid || queueDropInvalid) {
    const errors: string[] = [];
    if (queueModeInvalid) {
      errors.push(
        `Unrecognized queue mode "${directives.rawQueueMode ?? ""}". Valid modes: steer, followup, collect, steer+backlog, interrupt.`,
      );
    }
    if (queueDebounceInvalid) {
      errors.push(
        `Invalid debounce "${directives.rawDebounce ?? ""}". Use ms/s/m (e.g. debounce:1500ms, debounce:2s).`,
      );
    }
    if (queueCapInvalid) {
      errors.push(
        `Invalid cap "${directives.rawCap ?? ""}". Use a positive integer (e.g. cap:10).`,
      );
    }
    if (queueDropInvalid) {
      errors.push(
        `Invalid drop policy "${directives.rawDrop ?? ""}". Use drop:old, drop:new, or drop:summarize.`,
      );
    }
    return { text: errors.join(" ") };
  }

  return undefined;
}
