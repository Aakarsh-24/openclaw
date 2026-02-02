import crypto from "node:crypto";
import type { OpenClawConfig } from "../../config/config.js";
import {
  loadSessionStore,
  mergeSessionEntry,
  resolveStorePath,
  type SessionEntry,
  updateSessionStore,
} from "../../config/sessions.js";

export async function resolveCronSession(params: {
  cfg: OpenClawConfig;
  sessionKey: string;
  nowMs: number;
  agentId: string;
}) {
  const sessionCfg = params.cfg.session;
  const storePath = resolveStorePath(sessionCfg?.store, {
    agentId: params.agentId,
  });
  let isNewSession = false;

  const sessionEntry = await updateSessionStore(storePath, (currentStore) => {
    const current = currentStore[params.sessionKey];

    const sessionId = current?.sessionId ?? crypto.randomUUID();
    isNewSession = !current;

    const patch: Partial<SessionEntry> = {
      sessionId,
      updatedAt: params.nowMs,
      systemSent: false,
    };

    const merged = mergeSessionEntry(current, patch);
    currentStore[params.sessionKey] = merged;
    return merged;
  });

  return {
    storePath,
    store: loadSessionStore(storePath),
    sessionEntry,
    systemSent: false,
    isNewSession,
  };
}
