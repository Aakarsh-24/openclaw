import { format } from "node:util";
import { mergeAllowlist, summarizeMapping, type RuntimeEnv } from "openclaw/plugin-sdk";
import type { CoreConfig, ReplyToMode } from "../../types.js";
import { resolveMatrixTargets } from "../../resolve-targets.js";
import { getMatrixRuntime } from "../../runtime.js";
import { setActiveMatrixClient } from "../active-client.js";
import {
  isBunRuntime,
  resolveMatrixAuth,
  resolveSharedMatrixClient,
  stopSharedClient,
} from "../client.js";
import { registerMatrixAutoJoin } from "./auto-join.js";
import { createDirectRoomTracker } from "./direct.js";
import { registerMatrixMonitorEvents } from "./events.js";
import { createMatrixRoomMessageHandler } from "./handler.js";
import { createMatrixRoomInfoResolver } from "./room-info.js";
import type { MatrixRawEvent, RoomMessageEventContent } from "./types.js";
import { EventType } from "./types.js";

export type MonitorMatrixOpts = {
  runtime?: RuntimeEnv;
  abortSignal?: AbortSignal;
  mediaMaxMb?: number;
  initialSyncLimit?: number;
  replyToMode?: ReplyToMode;
  accountId?: string | null;
};

const DEFAULT_MEDIA_MAX_MB = 20;

export async function monitorMatrixProvider(opts: MonitorMatrixOpts = {}): Promise<void> {
  if (isBunRuntime()) {
    throw new Error("Matrix provider requires Node (bun runtime not supported)");
  }
  const core = getMatrixRuntime();
  let cfg = core.config.loadConfig() as CoreConfig;
  if (cfg.channels?.matrix?.enabled === false) {
    return;
  }

  const logger = core.logging.getChildLogger({ module: "matrix-auto-reply" });
  const formatRuntimeMessage = (...args: Parameters<RuntimeEnv["log"]>) => format(...args);
  const runtime: RuntimeEnv = opts.runtime ?? {
    log: (...args) => {
      logger.info(formatRuntimeMessage(...args));
    },
    error: (...args) => {
      logger.error(formatRuntimeMessage(...args));
    },
    exit: (code: number): never => {
      throw new Error(`exit ${code}`);
    },
  };
  const logVerboseMessage = (message: string) => {
    if (!core.logging.shouldLogVerbose()) {
      return;
    }
    logger.debug(message);
  };

  const normalizeUserEntry = (raw: string) =>
    raw
      .replace(/^matrix:/i, "")
      .replace(/^user:/i, "")
      .trim();
  const normalizeRoomEntry = (raw: string) =>
    raw
      .replace(/^matrix:/i, "")
      .replace(/^(room|channel):/i, "")
      .trim();
  const isMatrixUserId = (value: string) => value.startsWith("@") && value.includes(":");

  const allowlistOnly = cfg.channels?.matrix?.allowlistOnly === true;
  let allowFrom = cfg.channels?.matrix?.dm?.allowFrom ?? [];
  let roomsConfig = cfg.channels?.matrix?.groups ?? cfg.channels?.matrix?.rooms;

  if (allowFrom.length > 0) {
    const entries = allowFrom
      .map((entry) => normalizeUserEntry(String(entry)))
      .filter((entry) => entry && entry !== "*");
    if (entries.length > 0) {
      const mapping: string[] = [];
      const unresolved: string[] = [];
      const additions: string[] = [];
      const pending: string[] = [];
      for (const entry of entries) {
        if (isMatrixUserId(entry)) {
          additions.push(entry);
          continue;
        }
        pending.push(entry);
      }
      if (pending.length > 0) {
        const resolved = await resolveMatrixTargets({
          cfg,
          inputs: pending,
          kind: "user",
          runtime,
        });
        for (const entry of resolved) {
          if (entry.resolved && entry.id) {
            additions.push(entry.id);
            mapping.push(`${entry.input}→${entry.id}`);
          } else {
            unresolved.push(entry.input);
          }
        }
      }
      allowFrom = mergeAllowlist({ existing: allowFrom, additions });
      summarizeMapping("matrix users", mapping, unresolved, runtime);
    }
  }

  if (roomsConfig && Object.keys(roomsConfig).length > 0) {
    const entries = Object.keys(roomsConfig).filter((key) => key !== "*");
    const mapping: string[] = [];
    const unresolved: string[] = [];
    const nextRooms = { ...roomsConfig };
    const pending: Array<{ input: string; query: string }> = [];
    for (const entry of entries) {
      const trimmed = entry.trim();
      if (!trimmed) {
        continue;
      }
      const cleaned = normalizeRoomEntry(trimmed);
      if (cleaned.startsWith("!") && cleaned.includes(":")) {
        if (!nextRooms[cleaned]) {
          nextRooms[cleaned] = roomsConfig[entry];
        }
        mapping.push(`${entry}→${cleaned}`);
        continue;
      }
      pending.push({ input: entry, query: trimmed });
    }
    if (pending.length > 0) {
      const resolved = await resolveMatrixTargets({
        cfg,
        inputs: pending.map((entry) => entry.query),
        kind: "group",
        runtime,
      });
      resolved.forEach((entry, index) => {
        const source = pending[index];
        if (!source) {
          return;
        }
        if (entry.resolved && entry.id) {
          if (!nextRooms[entry.id]) {
            nextRooms[entry.id] = roomsConfig[source.input];
          }
          mapping.push(`${source.input}→${entry.id}`);
        } else {
          unresolved.push(source.input);
        }
      });
    }
    roomsConfig = nextRooms;
    summarizeMapping("matrix rooms", mapping, unresolved, runtime);
  }

  cfg = {
    ...cfg,
    channels: {
      ...cfg.channels,
      matrix: {
        ...cfg.channels?.matrix,
        dm: {
          ...cfg.channels?.matrix?.dm,
          allowFrom,
        },
        ...(roomsConfig ? { groups: roomsConfig } : {}),
      },
    },
  };

  const auth = await resolveMatrixAuth({ cfg });
  const resolvedInitialSyncLimit =
    typeof opts.initialSyncLimit === "number"
      ? Math.max(0, Math.floor(opts.initialSyncLimit))
      : auth.initialSyncLimit;
  const authWithLimit =
    resolvedInitialSyncLimit === auth.initialSyncLimit
      ? auth
      : { ...auth, initialSyncLimit: resolvedInitialSyncLimit };
  const client = await resolveSharedMatrixClient({
    cfg,
    auth: authWithLimit,
    startClient: false,
    accountId: opts.accountId,
  });
  setActiveMatrixClient(client);

  const mentionRegexes = core.channel.mentions.buildMentionRegexes(cfg);
  const defaultGroupPolicy = cfg.channels?.defaults?.groupPolicy;
  const groupPolicyRaw = cfg.channels?.matrix?.groupPolicy ?? defaultGroupPolicy ?? "allowlist";
  const groupPolicy = allowlistOnly && groupPolicyRaw === "open" ? "allowlist" : groupPolicyRaw;
  const replyToMode = opts.replyToMode ?? cfg.channels?.matrix?.replyToMode ?? "off";
  const threadReplies = cfg.channels?.matrix?.threadReplies ?? "inbound";
  const dmConfig = cfg.channels?.matrix?.dm;
  const dmEnabled = dmConfig?.enabled ?? true;
  const dmPolicyRaw = dmConfig?.policy ?? "pairing";
  const dmPolicy = allowlistOnly && dmPolicyRaw !== "disabled" ? "allowlist" : dmPolicyRaw;
  const textLimit = core.channel.text.resolveTextChunkLimit(cfg, "matrix");
  const mediaMaxMb = opts.mediaMaxMb ?? cfg.channels?.matrix?.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB;
  const mediaMaxBytes = Math.max(1, mediaMaxMb) * 1024 * 1024;
  const startupMs = Date.now();
  const startupGraceMs = 0;
  const directTracker = createDirectRoomTracker(client, { log: logVerboseMessage });
  registerMatrixAutoJoin({ client, cfg, runtime });
  const warnedEncryptedRooms = new Set<string>();
  const warnedCryptoMissingRooms = new Set<string>();

  const { getRoomInfo, getMemberDisplayName } = createMatrixRoomInfoResolver(client);
  const handleRoomMessage = createMatrixRoomMessageHandler({
    client,
    core,
    cfg,
    runtime,
    logger,
    logVerboseMessage,
    allowFrom,
    roomsConfig,
    mentionRegexes,
    groupPolicy,
    replyToMode,
    threadReplies,
    dmEnabled,
    dmPolicy,
    textLimit,
    mediaMaxBytes,
    startupMs,
    startupGraceMs,
    directTracker,
    getRoomInfo,
    getMemberDisplayName,
  });

  // Set up inbound message debouncing to batch rapid messages from the same sender
  const debounceMs = core.channel.debounce.resolveInboundDebounceMs({ cfg, channel: "matrix" });

  type MatrixDebounceEntry = {
    roomId: string;
    event: MatrixRawEvent;
    debounceKey: string | null;
  };

  const inboundDebouncer = core.channel.debounce.createInboundDebouncer<MatrixDebounceEntry>({
    debounceMs,
    buildKey: (entry) => entry.debounceKey,
    shouldDebounce: (entry) => {
      const event = entry.event;
      // Don't debounce non-message events
      if (event.type !== EventType.RoomMessage) {
        return false;
      }
      // Don't debounce if no text content (media-only)
      const content = event.content as RoomMessageEventContent | undefined;
      const text = typeof content?.body === "string" ? content.body.trim() : "";
      if (!text) {
        return false;
      }
      // Don't debounce control commands - process immediately
      if (core.channel.text.hasControlCommand(text, cfg)) {
        return false;
      }
      return true;
    },
    onFlush: async (entries) => {
      if (entries.length === 0) {
        return;
      }

      // Single message - process directly
      if (entries.length === 1) {
        const entry = entries[0];
        if (entry) {
          await handleRoomMessage(entry.roomId, entry.event);
        }
        return;
      }

      // Multiple messages - combine text and process as one
      const first = entries[0];
      const last = entries.at(-1);
      if (!first || !last) {
        return;
      }

      // Combine body text from all events
      const combinedText = entries
        .map((entry) => {
          const content = entry.event.content as RoomMessageEventContent | undefined;
          return typeof content?.body === "string" ? content.body : "";
        })
        .filter(Boolean)
        .join("\n");

      if (!combinedText.trim()) {
        // No text to combine, just process the first event
        await handleRoomMessage(first.roomId, first.event);
        return;
      }

      // Create synthetic event with combined text, using last event's ID for reply targeting
      const syntheticEvent: MatrixRawEvent = {
        ...first.event,
        event_id: last.event.event_id,
        origin_server_ts: last.event.origin_server_ts ?? first.event.origin_server_ts,
        content: {
          ...first.event.content,
          body: combinedText,
        },
      };

      logVerboseMessage(
        `matrix: debounced ${entries.length} messages from ${first.event.sender ?? "unknown"} in ${first.roomId}`,
      );

      await handleRoomMessage(first.roomId, syntheticEvent);
    },
    onError: (err) => {
      runtime.error?.(`matrix debounce flush failed: ${String(err)}`);
    },
  });

  // Wrapper that enqueues events to the debouncer
  const debouncedRoomMessageHandler = async (roomId: string, event: MatrixRawEvent) => {
    const senderId = event.sender;
    // Build debounce key: channel:accountId:room:sender
    const accountId = opts.accountId ?? "default";
    const debounceKey = senderId ? `matrix:${accountId}:${roomId}:${senderId}` : null;

    await inboundDebouncer.enqueue({
      roomId,
      event,
      debounceKey,
    });
  };

  registerMatrixMonitorEvents({
    client,
    auth,
    logVerboseMessage,
    warnedEncryptedRooms,
    warnedCryptoMissingRooms,
    logger,
    formatNativeDependencyHint: core.system.formatNativeDependencyHint,
    onRoomMessage: debouncedRoomMessageHandler,
  });

  logVerboseMessage("matrix: starting client");
  await resolveSharedMatrixClient({
    cfg,
    auth: authWithLimit,
    accountId: opts.accountId,
  });
  logVerboseMessage("matrix: client started");

  // @vector-im/matrix-bot-sdk client is already started via resolveSharedMatrixClient
  logger.info(`matrix: logged in as ${auth.userId}`);

  // If E2EE is enabled, trigger device verification
  if (auth.encryption && client.crypto) {
    try {
      // Request verification from other sessions
      const verificationRequest = await client.crypto.requestOwnUserVerification();
      if (verificationRequest) {
        logger.info("matrix: device verification requested - please verify in another client");
      }
    } catch (err) {
      logger.debug(
        { error: String(err) },
        "Device verification request failed (may already be verified)",
      );
    }
  }

  await new Promise<void>((resolve) => {
    const onAbort = () => {
      try {
        logVerboseMessage("matrix: stopping client");
        stopSharedClient();
      } finally {
        setActiveMatrixClient(null);
        resolve();
      }
    };
    if (opts.abortSignal?.aborted) {
      onAbort();
      return;
    }
    opts.abortSignal?.addEventListener("abort", onAbort, { once: true });
  });
}
