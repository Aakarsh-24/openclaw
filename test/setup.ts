import { vi } from "vitest";

import { installTestEnv } from "./test-env";

// Mock sharp to eliminate ~100MB dependency - use Rust backend instead
vi.mock("sharp", async () => {
  const { createMockSharp } = await import("./helpers/test-images.js");
  return { default: createMockSharp() };
});

const { cleanup } = installTestEnv();
process.on("exit", cleanup);
