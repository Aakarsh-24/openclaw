import type { GatewayRequestHandlers } from "./types.js";
import {
  formatDoctorNonInteractiveHint,
  type RestartSentinelPayload,
  writeRestartSentinel,
} from "../../infra/restart-sentinel.js";
import { scheduleGatewaySigusr1Restart } from "../../infra/restart.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

export const gatewayHandlers: GatewayRequestHandlers = {
  "gateway.restart": async ({ params, respond }) => {
    const reason = typeof params.reason === "string" ? params.reason.trim() : "";
    const note = typeof params.note === "string" ? params.note.trim() : "";
    const sessionKey =
      typeof params.sessionKey === "string" ? params.sessionKey.trim() || undefined : undefined;

    const restartDelayMsRaw = (params as { restartDelayMs?: unknown }).restartDelayMs;
    const restartDelayMs =
      typeof restartDelayMsRaw === "number" && Number.isFinite(restartDelayMsRaw)
        ? Math.max(0, Math.floor(restartDelayMsRaw))
        : undefined;

    const restartReason = reason || "gateway.restart";

    const payload: RestartSentinelPayload = {
      kind: "restart",
      status: "ok",
      ts: Date.now(),
      sessionKey,
      message: note || reason || null,
      doctorHint: formatDoctorNonInteractiveHint(),
      stats: {
        mode: "gateway.restart",
        reason: restartReason,
      },
    };

    let sentinelPath: string | null = null;
    try {
      sentinelPath = await writeRestartSentinel(payload);
    } catch {
      sentinelPath = null;
    }

    const restart = scheduleGatewaySigusr1Restart({
      delayMs: restartDelayMs,
      reason: restartReason,
    });

    if (!restart.ok) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "restart scheduling failed"));
      return;
    }

    respond(
      true,
      {
        ok: true,
        restart,
        sentinel: {
          path: sentinelPath,
          payload,
        },
      },
      undefined,
    );
  },
};
