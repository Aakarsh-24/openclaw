/**
 * Claude Agent SDK integration module.
 *
 * Provides an alternative agent runtime using the Claude Agent SDK.
 *
 * @module agents/claude-agent-sdk
 */

export { isSdkAvailable, loadClaudeAgentSdk, resetSdkLoaderForTest } from "./sdk-loader.js";
export {
  buildAnthropicSdkProvider,
  buildBedrockSdkProvider,
  buildClaudeCliSdkProvider,
  buildOpenRouterSdkProvider,
  buildVertexSdkProvider,
  buildZaiSdkProvider,
  resolveProviderConfig,
} from "./provider-config.js";
export { runSdkAgent } from "./sdk-runner.js";
export { createCcSdkAgentRuntime, type CcSdkAgentRuntimeContext } from "./sdk-agent-runtime.js";
export {
  bridgeMoltbotToolsToMcpServer,
  bridgeMoltbotToolsSync,
  buildMcpAllowedTools,
  convertToolResult,
  extractJsonSchema,
  mcpToolName,
  resetMcpServerCache,
  wrapToolHandler,
  type BridgeOptions,
  type BridgeResult,
} from "./tool-bridge.js";
export type {
  McpCallToolResult,
  McpContentBlock,
  McpImageContent,
  McpSdkServerConfig,
  McpServerConstructor,
  McpServerLike,
  McpTextContent,
  SdkRunnerQueryOptions,
} from "./tool-bridge.types.js";
export type {
  SdkDoneEvent,
  SdkErrorEvent,
  SdkEvent,
  SdkEventType,
  SdkProviderConfig,
  SdkProviderEnv,
  SdkRunnerParams,
  SdkTextEvent,
  SdkToolResultEvent,
  SdkToolUseEvent,
} from "./types.js";
