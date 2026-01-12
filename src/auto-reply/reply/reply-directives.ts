import { splitMediaFromOutput } from "../../media/parse.js";
import { parseInlineDirectives } from "../../utils/directive-tags.js";
import { isSilentReplyText, SILENT_REPLY_TOKEN } from "../tokens.js";

const SPLIT_TAG_RE = /\[\[\s*split\s*\]\]/gi;

export type ReplyDirectiveParseResult = {
  text: string;
  mediaUrls?: string[];
  mediaUrl?: string;
  replyToId?: string;
  replyToCurrent: boolean;
  replyToTag: boolean;
  audioAsVoice?: boolean;
  isSilent: boolean;
};

export type SplitReplyDirectiveParseResult = {
  segments: ReplyDirectiveParseResult[];
  usedSplit: boolean;
};

export function parseReplyDirectives(
  raw: string,
  options: { currentMessageId?: string; silentToken?: string } = {},
): ReplyDirectiveParseResult {
  const split = splitMediaFromOutput(raw);
  let text = split.text ?? "";

  const replyParsed = parseInlineDirectives(text, {
    currentMessageId: options.currentMessageId,
    stripAudioTag: false,
    stripReplyTags: true,
  });

  if (replyParsed.hasReplyTag) {
    text = replyParsed.text;
  }

  const silentToken = options.silentToken ?? SILENT_REPLY_TOKEN;
  const isSilent = isSilentReplyText(text, silentToken);
  if (isSilent) {
    text = "";
  }

  return {
    text,
    mediaUrls: split.mediaUrls,
    mediaUrl: split.mediaUrl,
    replyToId: replyParsed.replyToId,
    replyToCurrent: replyParsed.replyToCurrent,
    replyToTag: replyParsed.hasReplyTag,
    audioAsVoice: split.audioAsVoice,
    isSilent,
  };
}

function splitOnSplitTag(raw: string): string[] | null {
  if (!raw) return null;
  const hasSplit = SPLIT_TAG_RE.test(raw);
  SPLIT_TAG_RE.lastIndex = 0;
  if (!hasSplit) return null;
  return raw.split(SPLIT_TAG_RE);
}

export function parseSplitReplyDirectives(
  raw: string,
  options: { currentMessageId?: string; silentToken?: string } = {},
): SplitReplyDirectiveParseResult {
  const parts = splitOnSplitTag(raw);
  if (!parts) {
    return {
      segments: [parseReplyDirectives(raw, options)],
      usedSplit: false,
    };
  }

  const segments = parts.map((part) => parseReplyDirectives(part, options));
  let replyToId: string | undefined;
  let replyToCurrent = false;
  let replyToTag = false;

  for (const segment of segments) {
    if (!segment.replyToTag) continue;
    replyToTag = true;
    if (segment.replyToId) replyToId = segment.replyToId;
    if (segment.replyToCurrent) replyToCurrent = true;
  }

  if (replyToTag) {
    for (const segment of segments) {
      segment.replyToTag = true;
      segment.replyToCurrent = replyToCurrent || segment.replyToCurrent;
      if (replyToId) segment.replyToId = replyToId;
    }
  }

  return { segments, usedSplit: true };
}
