import type { Guild, Message, User } from "@buape/carbon";

import { formatAgentEnvelope, type EnvelopeFormatOptions } from "../../auto-reply/envelope.js";
import { formatDiscordUserTag, resolveTimestampMs } from "./format.js";

export function resolveReplyContext(
  message: Message,
  resolveDiscordMessageText: (message: Message, options?: { includeForwarded?: boolean }) => string,
  options?: { envelope?: EnvelopeFormatOptions },
): string | null {
  const referenced = message.referencedMessage;
  if (!referenced?.author) return null;
  const referencedText = resolveDiscordMessageText(referenced, {
    includeForwarded: true,
  });
  if (!referencedText) return null;
  const fromLabel = referenced.author ? buildDirectLabel(referenced.author) : "Unknown";
  // Body contains only user content - no metadata (see Evolution Queue #44)
  const body = referencedText;
  return formatAgentEnvelope({
    channel: "Discord",
    from: fromLabel,
    timestamp: resolveTimestampMs(referenced.timestamp),
    body,
    envelope: options?.envelope,
  });
}

export function buildDirectLabel(author: User) {
  // Return only username - no user ID (see Evolution Queue #44)
  return formatDiscordUserTag(author);
}

export function buildGuildLabel(params: { guild?: Guild; channelName: string; channelId: string }) {
  // Return only guild and channel name - no channel ID (see Evolution Queue #44)
  const { guild, channelName } = params;
  return `${guild?.name ?? "Guild"} #${channelName}`;
}
