import type { MsgContext } from "../templating.js";
import { isAudioFileName } from "../../media/mime.js";
import { isAudio } from "../transcription.js";

type AudioAttachment = { path?: string; url?: string; type?: string };

export function resolveAudioAttachment(ctx: MsgContext): AudioAttachment | undefined {
  const paths = Array.isArray(ctx.MediaPaths) ? ctx.MediaPaths : [];
  const urls = Array.isArray(ctx.MediaUrls) ? ctx.MediaUrls : [];
  const types = Array.isArray(ctx.MediaTypes) ? ctx.MediaTypes : [];
  const total =
    paths.length > 0 ? paths.length : urls.length > 0 ? urls.length : 0;
  const allowGlobalTypeFallback = total <= 1;

  const scan = (entries: AudioAttachment[]) => {
    for (const entry of entries) {
      if (entry.type && isAudio(entry.type)) return entry;
      if (entry.path && isAudioFileName(entry.path)) return entry;
      if (entry.url && isAudioFileName(entry.url)) return entry;
    }
    return undefined;
  };

  if (paths.length > 0) {
    const entries = paths.map((pathValue, index) => ({
      path: pathValue,
      url: urls[index] ?? ctx.MediaUrl,
      type: types[index] ?? (allowGlobalTypeFallback ? ctx.MediaType : undefined),
    }));
    const found = scan(entries);
    if (found) return found;
  }

  if (urls.length > 0) {
    const entries = urls.map((urlValue, index) => ({
      path: undefined,
      url: urlValue,
      type: types[index] ?? (allowGlobalTypeFallback ? ctx.MediaType : undefined),
    }));
    const found = scan(entries);
    if (found) return found;
  }

  const fallback = {
    path: ctx.MediaPath,
    url: ctx.MediaUrl,
    type: ctx.MediaType,
  };
  return scan([fallback]) ?? undefined;
}
