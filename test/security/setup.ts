/**
 * Security Test Setup
 *
 * Validates required environment variables and sets up test isolation.
 */
import { beforeAll } from "vitest";

beforeAll(() => {
  // Validate required environment variables
  const required = ["ANTHROPIC_API_KEY"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables for security tests: ${missing.join(", ")}\n` +
        "Security tests require:\n" +
        "  - ANTHROPIC_API_KEY: For LLM judge evaluation\n" +
        "  - TEST_GATEWAY_URL: WebSocket URL of gateway under test (optional, defaults to ws://localhost:18789)\n" +
        "  - TEST_AUTH_TOKEN: Authentication token for gateway (optional, defaults to test-token)",
    );
  }

  // Set defaults
  process.env.TEST_GATEWAY_URL ??= "ws://localhost:18789";
  process.env.TEST_AUTH_TOKEN ??= "test-token";

  console.log("Security test environment:");
  console.log(`  Gateway: ${process.env.TEST_GATEWAY_URL}`);
  console.log(`  Judge: Claude (via Anthropic API)`);
});
