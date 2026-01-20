import type { BlockStreamingCoalesceConfig, DmPolicy, GroupPolicy } from "./types.base.js";
import type { DmConfig } from "./types.messages.js";

export type NextcloudTalkRoomConfig = {
  requireMention?: boolean;
  /** If specified, only load these skills for this room. Omit = all skills; empty = no skills. */
  skills?: string[];
  /** If false, disable the bot for this room. */
  enabled?: boolean;
  /** Optional allowlist for room senders (user ids). */
  allowFrom?: string[];
  /** Optional system prompt snippet for this room. */
  systemPrompt?: string;
};

export type NextcloudTalkAccountConfig = {
  /** Optional display name for this account (used in CLI/UI lists). */
  name?: string;
  /** If false, do not start this Nextcloud Talk account. Default: true. */
  enabled?: boolean;
  /** Base URL of the Nextcloud instance (e.g., "https://cloud.example.com"). */
  baseUrl?: string;
  /** Bot shared secret from occ talk:bot:install output. */
  botSecret?: string;
  /** Path to file containing bot secret (for secret managers). */
  botSecretFile?: string;
  /**
   * Controls how Nextcloud Talk direct chats (DMs) are handled:
   * - "pairing" (default): unknown senders get a pairing code; owner must approve
   * - "allowlist": only allow senders in allowFrom (or paired allow store)
   * - "open": allow all inbound DMs (requires allowFrom to include "*")
   * - "disabled": ignore all inbound DMs
   */
  dmPolicy?: DmPolicy;
  /** Webhook server port. Default: 8788. */
  webhookPort?: number;
  /** Webhook server host. Default: "0.0.0.0". */
  webhookHost?: string;
  /** Webhook endpoint path. Default: "/nextcloud-talk-webhook". */
  webhookPath?: string;
  /** Public URL for the webhook (used if behind reverse proxy). */
  webhookPublicUrl?: string;
  /** Optional allowlist of user IDs allowed to DM the bot. */
  allowFrom?: string[];
  /** Optional allowlist for Nextcloud Talk room senders (user ids). */
  groupAllowFrom?: string[];
  /**
   * Controls how group messages are handled:
   * - "open": groups bypass allowFrom, only mention-gating applies
   * - "disabled": block all group messages entirely
   * - "allowlist": only allow group messages from senders in groupAllowFrom/allowFrom
   */
  groupPolicy?: GroupPolicy;
  /** Per-room configuration (key is room token). */
  rooms?: Record<string, NextcloudTalkRoomConfig>;
  /** Max group messages to keep as history context (0 disables). */
  historyLimit?: number;
  /** Max DM turns to keep as history context. */
  dmHistoryLimit?: number;
  /** Per-DM config overrides keyed by user ID. */
  dms?: Record<string, DmConfig>;
  /** Outbound text chunk size (chars). Default: 4000. */
  textChunkLimit?: number;
  /** Disable block streaming for this account. */
  blockStreaming?: boolean;
  /** Merge streamed block replies before sending. */
  blockStreamingCoalesce?: BlockStreamingCoalesceConfig;
  /** Media upload max size in MB. */
  mediaMaxMb?: number;
};

export type NextcloudTalkConfig = {
  /** Optional per-account Nextcloud Talk configuration (multi-account). */
  accounts?: Record<string, NextcloudTalkAccountConfig>;
} & NextcloudTalkAccountConfig;
