import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { createTestJpeg, createLargeTestPng } from "../../test/helpers/test-images.js";
import { getImageMetadata } from "../media/image-ops.js";
import { normalizeBrowserScreenshot } from "./screenshot.js";

describe("browser screenshot normalization", () => {
  it("shrinks oversized images to <=2000x2000 and <=5MB", async () => {
    const bigPng = await createLargeTestPng(); // Creates 2800x2800 PNG >5MB

    const normalized = await normalizeBrowserScreenshot(bigPng, {
      maxSide: 2000,
      maxBytes: 5 * 1024 * 1024,
    });

    expect(normalized.buffer.byteLength).toBeLessThanOrEqual(5 * 1024 * 1024);
    const meta = await getImageMetadata(normalized.buffer);
    expect(meta).not.toBeNull();
    if (meta) {
      expect(meta.width).toBeLessThanOrEqual(2000);
      expect(meta.height).toBeLessThanOrEqual(2000);
    }
    // Check JPEG magic bytes
    expect(normalized.buffer[0]).toBe(0xff);
    expect(normalized.buffer[1]).toBe(0xd8);
  }, 120_000);

  it("keeps already-small screenshots unchanged", async () => {
    const jpeg = createTestJpeg();

    const normalized = await normalizeBrowserScreenshot(jpeg, {
      maxSide: 2000,
      maxBytes: 5 * 1024 * 1024,
    });

    expect(normalized.buffer.equals(jpeg)).toBe(true);
  });
});
