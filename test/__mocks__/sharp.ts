/**
 * Vitest mock for sharp module.
 * This mock replaces the sharp npm package to eliminate the ~100MB dependency.
 * Uses the abstracted image-ops functions backed by Rust binary instead.
 */

import { createMockSharp } from "../helpers/test-images.js";

// Export the mock sharp function as default
export default createMockSharp();

// Also export as named export for CJS compatibility
export const sharp = createMockSharp();
