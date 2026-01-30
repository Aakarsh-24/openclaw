/**
 * Feishu channel module exports
 * @module feishu
 */

// Core bot functionality
export {
  createFeishuBot,
  createFeishuBotFromAccount,
  type FeishuBot,
  type FeishuBotOptions,
} from "./bot.js";

// Account management
export {
  resolveFeishuAccount,
  listFeishuAccountIds,
  resolveDefaultFeishuAccountId,
  normalizeAccountId,
  isUserAllowed,
  isGroupAllowed,
  DEFAULT_ACCOUNT_ID,
  type ResolveFeishuAccountParams,
} from "./accounts.js";

// Message sending
export {
  sendMessage,
  sendTextMessage,
  sendRichTextMessage,
  sendCardMessage,
  sendImageMessage,
  sendFileMessage,
  replyMessage,
  replyCardMessage,
  uploadImage,
  uploadFile,
  getUserInfo,
  type SendMessageParams,
  type ReceiveIdType,
} from "./send.js";

// Event handling
export {
  handleFeishuWebhookEvents,
  shouldProcessFeishuEvent,
  resolveFeishuGroupConfig,
  type FeishuHandlerContext,
  type FeishuEventWrapper,
} from "./bot-handlers.js";

// Message context
export { buildFeishuMessageContext } from "./bot-message-context.js";

// Webhook
export {
  createFeishuWebhookHandler,
  createFeishuExpressMiddleware,
  startFeishuWebhook,
  verifyWebhookSignature,
  type FeishuWebhookHandler,
  type FeishuWebhookOptions,
  type StartFeishuWebhookOptions,
} from "./webhook.js";

// Monitoring
export {
  monitorFeishuProvider,
  getFeishuRuntimeState,
  getFeishuClient,
  getFeishuAccountState,
  type FeishuProviderState,
  type FeishuRuntimeState,
  type MonitorFeishuProviderOptions,
  type FeishuProviderMonitor,
} from "./monitor.js";

// Probing
export { probeFeishuBot, probeFeishuCredentials } from "./probe.js";

// Configuration schema
export {
  FeishuConfigSchema,
  FeishuAccountConfigSchema,
  FeishuGroupConfigSchema,
  type FeishuConfigSchemaType,
  type FeishuAccountConfigSchemaType,
  type FeishuGroupConfigSchemaType,
} from "./config-schema.js";

// Types
export type {
  FeishuConfig,
  FeishuAccountConfig,
  FeishuGroupConfig,
  FeishuTokenSource,
  ResolvedFeishuAccount,
  FeishuMessageType,
  FeishuTextContent,
  FeishuPostContent,
  FeishuPostParagraph,
  FeishuImageContent,
  FeishuFileContent,
  FeishuCardContent,
  FeishuCardElement,
  FeishuCardDiv,
  FeishuCardMarkdown,
  FeishuCardAction,
  FeishuCardNote,
  FeishuCardDivider,
  FeishuWebhookEvent,
  FeishuEventPayload,
  FeishuMessageReceiveEvent,
  FeishuMessageReactionEvent,
  FeishuBotAddedEvent,
  FeishuBotRemovedEvent,
  FeishuInboundContext,
  FeishuSendResult,
  FeishuProbeResult,
  FeishuChannelData,
} from "./types.js";
