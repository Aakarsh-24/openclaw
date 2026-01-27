import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";

import { xmtpPlugin } from "./src/channel.js";
import { setXmtpRuntime } from "./src/runtime.js";

// Re-export types for consumers
export type {
  ResolvedXmtpAccount,
  XmtpAccountSnapshot,
  XmtpActionConfig,
  XmtpActionResult,
  XmtpAuthorizationResult,
  XmtpChannelSummary,
  XmtpConfig,
  XmtpDmPolicy,
  XmtpEnv,
  XmtpGroupEntry,
  XmtpInboundContext,
  XmtpMarkdownConfig,
  XmtpMarkdownTableMode,
  XmtpPeerEntry,
  XmtpPluginCapabilities,
  XmtpPluginMeta,
  XmtpReactParams,
  XmtpRetryConfig,
  XmtpRuntimeState,
  XmtpStatusIssue,
} from "./src/types.xmtp.js";

// Re-export schemas for validation
export {
  EthereumAddressSchema,
  safeValidateAccountConfig,
  validateAccountConfig,
  validateEthereumAddress,
  validateWalletKey,
  WalletKeySchema,
  XmtpAccountConfigSchema,
  XmtpActionConfigSchema,
  XmtpChannelConfigSchema,
  XmtpConfigSchema,
  XmtpDmPolicySchema,
  XmtpEnvSchema,
  XmtpMarkdownConfigSchema,
  XmtpMarkdownTableModeSchema,
  XmtpRetryConfigSchema,
} from "./src/schemas.xmtp.js";

// Re-export error classes
export {
  isRetryableError,
  wrapError,
  XmtpConfigError,
  XmtpError,
  XmtpSendError,
  XmtpValidationError,
} from "./src/errors.js";
export type { XmtpErrorCategory, XmtpErrorCode } from "./src/errors.js";

// Re-export onboarding adapter and wallet utilities
export {
  deriveAddress,
  generateWallet,
  xmtpOnboardingAdapter,
} from "./src/onboarding.js";
export type { GeneratedWallet, XmtpOnboardingAdapter } from "./src/onboarding.js";

// Re-export ENS utilities
export {
  clearCache as clearEnsCache,
  getCacheSize as getEnsCacheSize,
  isEnsName,
  namehash,
  normalizeEnsName,
  resolveBatch as resolveEnsBatch,
  resolveEnsName,
} from "./src/ens.js";

// Re-export plugin and utilities
export {
  DEFAULT_XMTP_ACCOUNT_ID,
  getAccountIdByAddress,
  getActiveXmtpAgent,
  isXmtpAccountEnabled,
  listXmtpAccountIds,
  normalizeXmtpAccountId,
  resolveDefaultXmtpAccountId,
  resolveXmtpAccount,
  validateMultiAccountConfig,
  xmtpPlugin,
} from "./src/channel.js";

// Re-export account types
export type { XmtpAccountConfig, XmtpConfigInput } from "./src/accounts.js";

const plugin = {
  id: "xmtp",
  name: "XMTP",
  description: "XMTP decentralized messaging channel plugin",
  register(api: ClawdbotPluginApi) {
    setXmtpRuntime(api.runtime);
    api.registerChannel({ plugin: xmtpPlugin });
  },
};

export default plugin;
