/**
 * Deep Research inline button handling
 * @see docs/sdd/deep-research/ui-flow.md
 */

import crypto from "node:crypto";
import { Buffer } from "node:buffer";

import { InlineKeyboard } from "grammy";

// Callback data prefix for deep research buttons
export const CALLBACK_PREFIX = "dr:";
const BASE64_PREFIX = "b64:";
const TOPIC_REF_PREFIX = "ref:";
// Prefix for owner IDs in callback data payloads.
const OWNER_ID_PREFIX = "u";

export const CallbackActions = {
  EXECUTE: "execute",
  RETRY: "retry",
  CANCEL: "cancel",
} as const;

const MAX_CALLBACK_DATA_BYTES = 64;
const TOPIC_STORE_TTL_MS = 30 * 60 * 1000;
const TOPIC_STORE_MAX_ENTRIES = 500;

type StoredTopic = {
  topic: string;
  expiresAt: number;
};

const topicStore = new Map<string, StoredTopic>();

function pruneTopicStore(now = Date.now()) {
  for (const [key, entry] of topicStore) {
    if (entry.expiresAt <= now) {
      topicStore.delete(key);
    }
  }
  if (topicStore.size <= TOPIC_STORE_MAX_ENTRIES) return;
  const overflow = topicStore.size - TOPIC_STORE_MAX_ENTRIES;
  let removed = 0;
  for (const key of topicStore.keys()) {
    topicStore.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function storeTopic(topic: string, maxBytes: number): string | null {
  const prefixBytes = Buffer.byteLength(TOPIC_REF_PREFIX, "utf-8");
  const available = Math.max(0, maxBytes - prefixBytes);
  if (available < 8) return null;

  pruneTopicStore();
  const tokenRaw = crypto.randomBytes(12).toString("base64url");
  const token = tokenRaw.slice(0, available);
  const ref = `${TOPIC_REF_PREFIX}${token}`;
  if (Buffer.byteLength(ref, "utf-8") > maxBytes) return null;
  topicStore.set(token, {
    topic,
    expiresAt: Date.now() + TOPIC_STORE_TTL_MS,
  });
  return ref;
}

function resolveStoredTopic(token: string): string | null {
  pruneTopicStore();
  const entry = topicStore.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    topicStore.delete(token);
    return null;
  }
  return entry.topic;
}

function encodeTopic(topic: string, maxBytes: number): string {
  const rawBytes = Buffer.byteLength(topic, "utf-8");
  if (
    rawBytes <= maxBytes &&
    !topic.startsWith(BASE64_PREFIX) &&
    !topic.startsWith(TOPIC_REF_PREFIX)
  ) {
    return topic;
  }

  const base64 = Buffer.from(topic).toString("base64");
  const available = Math.max(0, maxBytes - BASE64_PREFIX.length);
  if (base64.length <= available) {
    return `${BASE64_PREFIX}${base64}`;
  }

  const ref = storeTopic(topic, maxBytes);
  if (ref) return ref;

  const truncated = topic.slice(0, Math.max(0, maxBytes));
  return truncated;
}

function buildCallbackData(
  action: string,
  topic: string,
  ownerId?: number,
): string {
  const ownerSegment =
    ownerId !== undefined ? `${OWNER_ID_PREFIX}${ownerId}:` : "";
  const prefix = `${CALLBACK_PREFIX}${action}:${ownerSegment}`;
  const maxTopicBytes =
    MAX_CALLBACK_DATA_BYTES - Buffer.byteLength(prefix, "utf-8");
  const topicData = encodeTopic(topic, Math.max(0, maxTopicBytes));
  return `${prefix}${topicData}`;
}

/**
 * Create execute button with topic encoded in callback data
 */
export function createExecuteButton(
  topic: string,
  ownerId: number,
): InlineKeyboard {
  // Encode topic in callback (Telegram limit: 64 bytes)
  // Use base64 if topic too long
  return new InlineKeyboard().text(
    "🚀 Сделать депресерч",
    buildCallbackData(CallbackActions.EXECUTE, topic, ownerId),
  );
}

/**
 * Create retry button after failure
 */
export function createRetryButton(
  topic: string,
  ownerId: number,
): InlineKeyboard {
  return new InlineKeyboard().text(
    "🔄 Повторить",
    buildCallbackData(CallbackActions.RETRY, topic, ownerId),
  );
}

/**
 * Parse callback data from button press
 */
export function parseCallbackData(data: string): {
  action: string;
  topic: string;
  ownerId?: number;
} | null {
  if (!data.startsWith(CALLBACK_PREFIX)) {
    return null;
  }

  const withoutPrefix = data.slice(CALLBACK_PREFIX.length);
  const colonIndex = withoutPrefix.indexOf(":");

  if (colonIndex === -1) {
    return null;
  }

  const action = withoutPrefix.slice(0, colonIndex);
  const remainder = withoutPrefix.slice(colonIndex + 1);
  let topicData = remainder;
  let ownerId: number | undefined;
  const secondColonIndex = remainder.indexOf(":");

  if (secondColonIndex !== -1) {
    const maybeOwner = remainder.slice(0, secondColonIndex);
    // Support legacy owner format without the "u" prefix.
    if (/^\d+$/.test(maybeOwner)) {
      ownerId = Number(maybeOwner);
      topicData = remainder.slice(secondColonIndex + 1);
    } else if (
      maybeOwner.startsWith(OWNER_ID_PREFIX) &&
      /^\d+$/.test(maybeOwner.slice(OWNER_ID_PREFIX.length))
    ) {
      ownerId = Number(maybeOwner.slice(OWNER_ID_PREFIX.length));
      topicData = remainder.slice(secondColonIndex + 1);
    }
  }

  if (topicData.startsWith(BASE64_PREFIX)) {
    const base64Data = topicData.slice(BASE64_PREFIX.length);
    try {
      const decodedBase64 = Buffer.from(base64Data, "base64").toString("utf-8");
      if (decodedBase64.trim()) {
        return { action, topic: decodedBase64, ownerId };
      }
    } catch {
      // Fall through to return raw topic data.
    }
  }
  if (topicData.startsWith(TOPIC_REF_PREFIX)) {
    const token = topicData.slice(TOPIC_REF_PREFIX.length);
    const resolved = resolveStoredTopic(token);
    if (resolved) {
      return { action, topic: resolved, ownerId };
    }
  }

  return { action, topic: topicData, ownerId };
}
