import type { HistoryEntry } from "../auto-reply/reply/history.js";
import type { MoltbotConfig } from "../config/config.js";
import type { SessionScope } from "../config/sessions.js";
import type { DmPolicy } from "../config/types.js";
import type { RuntimeEnv } from "../runtime.js";
import type { ResolvedZoomAccount } from "./config.js";

export type ZoomMonitorContext = {
  cfg: MoltbotConfig;
  accountId: string;
  account: ResolvedZoomAccount;
  runtime: RuntimeEnv;

  historyLimit: number;
  channelHistories: Map<string, HistoryEntry[]>;
  sessionScope: SessionScope;
  mainKey: string;

  dmEnabled: boolean;
  dmPolicy: DmPolicy;
  allowFrom: string[];

  textLimit: number;
  replyToMode: "off" | "first" | "all";
  removeAckAfterReply: boolean;
};
