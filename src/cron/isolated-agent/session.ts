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
  const store = loadSessionStore(storePath);
  const existing = store[params.sessionKey];
  
  const sessionId = existing?.sessionId ?? crypto.randomUUID();
  const isNewSession = !existing;
  const systemSent = false;
  
  const patch: Partial<SessionEntry> = {
    sessionId,
    updatedAt: params.nowMs,
    systemSent,
  };

  let sessionEntry: SessionEntry;
  await updateSessionStore(storePath, (currentStore) => {
    const current = currentStore[params.sessionKey];
    sessionEntry = mergeSessionEntry(current, patch);
    currentStore[params.sessionKey] = sessionEntry;
  });

  const updatedStore = loadSessionStore(storePath);

  return {
    storePath,
    store: updatedStore,
    sessionEntry: sessionEntry!,
    systemSent,
    isNewSession
  };
}
