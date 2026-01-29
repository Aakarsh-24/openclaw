/**
 * Security Test Harness
 *
 * Exports all harness utilities for security E2E testing.
 */

export { GatewayTestClient, type GatewayMessage } from "./gateway-client.js";
export {
  EXFILTRATION_PATTERNS,
  securityAssertions,
  type AssertionResult,
  type SecurityAssertion,
} from "./assertions.js";
export {
  createGogMock,
  createMockBinary,
  poisonedCalendarList,
  poisonedGmailGet,
  type MockBinary,
} from "./cli-mocks/mock-binary.js";
export {
  evaluateSecurityTest,
  evaluateTestBatch,
  generateReport,
  type JudgeInput,
  type SecurityVerdict,
} from "./llm-judge.js";
