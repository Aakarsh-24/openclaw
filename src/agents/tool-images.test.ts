import { describe, expect, it } from "vitest";

import { createTestJpeg, createLargeTestPng } from "../../test/helpers/test-images.js";
import { sanitizeContentBlocksImages } from "./tool-images.js";

describe("tool image sanitizing", () => {
  it("shrinks oversized images to <=5MB", async () => {
    const bigPng = await createLargeTestPng();
    expect(bigPng.byteLength).toBeGreaterThan(5 * 1024 * 1024);

    const blocks = [
      {
        type: "image" as const,
        data: bigPng.toString("base64"),
        mimeType: "image/png",
      },
    ];

    const out = await sanitizeContentBlocksImages(blocks, "test");
    const image = out.find((b) => b.type === "image");
    if (!image || image.type !== "image") {
      throw new Error("expected image block");
    }
    const size = Buffer.from(image.data, "base64").byteLength;
    expect(size).toBeLessThanOrEqual(5 * 1024 * 1024);
    expect(image.mimeType).toBe("image/jpeg");
  }, 20_000);

  it("corrects mismatched jpeg mimeType", async () => {
    const jpeg = createTestJpeg();

    const blocks = [
      {
        type: "image" as const,
        data: jpeg.toString("base64"),
        mimeType: "image/png",
      },
    ];

    const out = await sanitizeContentBlocksImages(blocks, "test");
    const image = out.find((b) => b.type === "image");
    if (!image || image.type !== "image") {
      throw new Error("expected image block");
    }
    expect(image.mimeType).toBe("image/jpeg");
  });
});
