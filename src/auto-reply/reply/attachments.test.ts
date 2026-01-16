import { describe, expect, it } from "vitest";

import { resolveAudioAttachment } from "./attachments.js";

describe("resolveAudioAttachment", () => {
  it("does not apply ctx.MediaType across multiple attachments", () => {
    const ctx = {
      MediaPaths: ["image.jpg", "note.ogg"],
      MediaType: "audio/ogg",
    };

    const result = resolveAudioAttachment(ctx);

    expect(result?.path).toBe("note.ogg");
  });

  it("falls back to ctx.MediaType when only one attachment exists", () => {
    const ctx = {
      MediaPaths: ["blob.bin"],
      MediaType: "audio/ogg",
    };

    const result = resolveAudioAttachment(ctx);

    expect(result?.path).toBe("blob.bin");
    expect(result?.type).toBe("audio/ogg");
  });
});
