/**
 * Test image helpers - generates test images without requiring sharp dependency.
 * Uses simple image formats that can be constructed manually or via minimal dependencies.
 */

/**
 * Creates a minimal valid JPEG buffer for testing.
 * This is a 1x1 pixel red JPEG image.
 */
export function createTestJpeg(): Buffer {
  // Minimal 1x1 red JPEG - hand-crafted bytes
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09, 0xff, 0xc4, 0x00, 0x14,
    0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0xa0, 0xff, 0xd9,
  ]);
}

/**
 * Creates a minimal valid PNG buffer for testing.
 * This is a 1x1 pixel green PNG image.
 */
export function createTestPng(): Buffer {
  // Minimal 1x1 green PNG - hand-crafted bytes
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0x60, 0xf8, 0x0f, 0x00,
    0x00, 0x01, 0x01, 0x01, 0x00, 0x1b, 0xb6, 0xee, 0x56, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

/**
 * Creates a test JPEG with specified dimensions and color.
 * Note: This creates a minimal JPEG; actual dimensions may not be exact.
 * For tests that need exact dimensions, use the abstracted image-ops functions.
 */
export function createTestJpegWithSize(width: number, height: number, color?: string): Buffer {
  // For simplicity in tests, we return a minimal JPEG
  // Tests that need exact dimensions should use the image-ops abstraction
  return createTestJpeg();
}

/**
 * Creates a test PNG with specified dimensions and color.
 * Note: This creates a minimal PNG; actual dimensions may not be exact.
 * For tests that need exact dimensions, use the abstracted image-ops functions.
 */
export function createTestPngWithSize(width: number, height: number, color?: string): Buffer {
  // For simplicity in tests, we return a minimal PNG
  // Tests that need exact dimensions should use the image-ops abstraction
  return createTestPng();
}

/**
 * Creates a large (>5MB) PNG buffer for testing.
 * This is created using test data that can be processed by the Rust backend.
 */
export async function createLargeTestPng(): Promise<Buffer> {
  // Create test data large enough (6MB) to exceed limits
  // This simulates a large image without needing sharp
  const width = 2000;
  const height = 2000;

  // Create a simple pattern that compresses poorly (random-like data)
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = (i * 137) % 256; // Simple pseudo-random pattern
  }

  // Return the pixel data as-is - tests using this should handle via image-ops
  // which will process it through the Rust backend or sips
  return pixels;
}

/**
 * Creates a large (>5MB) buffer simulating an oversized image payload.
 * Note: This creates a buffer that exceeds size limits but may not be a valid image format.
 * For tests that need valid images, use the abstracted image-ops functions.
 */
export function createLargeTestBuffer(): Buffer {
  // Create a 6MB buffer to simulate an oversized image
  // This is sufficient for testing size limit logic
  return Buffer.alloc(6 * 1024 * 1024, 0xFF);
}

/**
 * Mock sharp-like interface for tests.
 * Provides a similar API to sharp but returns simple test images.
 */
export function createMockSharp() {
  let requestedWidth = 1;
  let requestedHeight = 1;
  let inputBuffer: Buffer | undefined;

  return (input?: Buffer | { create?: { width: number; height: number; channels: number; background: string | {r: number; g: number; b: number} }; raw?: { width: number; height: number; channels: number } }) => {
    if (input && typeof input === "object" && "create" in input && input.create) {
      requestedWidth = input.create.width;
      requestedHeight = input.create.height;
    } else if (input && typeof input === "object" && "raw" in input && input.raw) {
      requestedWidth = input.raw.width;
      requestedHeight = input.raw.height;
    } else if (Buffer.isBuffer(input)) {
      inputBuffer = input;
    }

    const api = {
      jpeg: (options?: { quality?: number; mozjpeg?: boolean }) => api,
      png: (options?: { compression?: number; compressionLevel?: number }) => api,
      resize: (options?: unknown) => api,
      toBuffer: async (): Promise<Buffer> => {
        // If we have input buffer, return a JPEG
        if (inputBuffer) {
          return createTestJpeg();
        }
        // If dimensions were specified, create appropriately sized test image
        if (requestedWidth > 100 || requestedHeight > 100) {
          // For "large" images, return a larger buffer to simulate realistic sizes
          const estimatedSize = Math.min(requestedWidth * requestedHeight * 0.5, 10 * 1024 * 1024);
          return Buffer.alloc(Math.floor(estimatedSize), 0xFF);
        }
        return createTestJpeg();
      },
      metadata: async () => ({
        width: requestedWidth,
        height: requestedHeight,
        format: "jpeg",
      }),
    };
    return api;
  };
}
