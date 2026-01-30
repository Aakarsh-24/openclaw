/**
 * Feishu (Lark) channel type definitions
 * @module feishu/types
 */

// ============================================================================
// Configuration Types
// ============================================================================

export type FeishuTokenSource = "config" | "env" | "file" | "none";

/**
 * Feishu channel configuration
 */
export interface FeishuConfig {
  enabled?: boolean;
  /** App ID from Feishu Open Platform */
  appId?: string;
  /** App Secret from Feishu Open Platform */
  appSecret?: string;
  /** File path to read appId from */
  appIdFile?: string;
  /** File path to read appSecret from */
  appSecretFile?: string;
  /** Encrypt key for event subscription (optional) */
  encryptKey?: string;
  /** Verification token for webhook (optional) */
  verificationToken?: string;
  /** Display name for this bot */
  name?: string;
  /** Allowed user IDs (open_id or user_id) */
  allowFrom?: Array<string>;
  /** Allowed group IDs for group chats */
  groupAllowFrom?: Array<string>;
  /** DM policy: open (allow all), allowlist (only allowFrom), pairing, disabled */
  dmPolicy?: "open" | "allowlist" | "pairing" | "disabled";
  /** Group policy: open (allow all), allowlist (only groupAllowFrom), disabled */
  groupPolicy?: "open" | "allowlist" | "disabled";
  /** Whether to require @mention in groups */
  requireMention?: boolean;
  /** Max media size in MB */
  mediaMaxMb?: number;
  /** Webhook path for receiving events */
  webhookPath?: string;
  /** Use long connection mode instead of webhook */
  useLongConnection?: boolean;
  /** Multiple accounts configuration */
  accounts?: Record<string, FeishuAccountConfig>;
  /** Group-specific configurations */
  groups?: Record<string, FeishuGroupConfig>;
}

/**
 * Individual account configuration
 */
export interface FeishuAccountConfig {
  enabled?: boolean;
  appId?: string;
  appSecret?: string;
  appIdFile?: string;
  appSecretFile?: string;
  encryptKey?: string;
  verificationToken?: string;
  name?: string;
  allowFrom?: Array<string>;
  groupAllowFrom?: Array<string>;
  dmPolicy?: "open" | "allowlist" | "pairing" | "disabled";
  groupPolicy?: "open" | "allowlist" | "disabled";
  requireMention?: boolean;
  mediaMaxMb?: number;
  webhookPath?: string;
  useLongConnection?: boolean;
  groups?: Record<string, FeishuGroupConfig>;
}

/**
 * Group-specific configuration
 */
export interface FeishuGroupConfig {
  enabled?: boolean;
  allowFrom?: Array<string>;
  requireMention?: boolean;
  systemPrompt?: string;
  skills?: string[];
}

/**
 * Resolved account with all credentials
 */
export interface ResolvedFeishuAccount {
  accountId: string;
  name?: string;
  enabled: boolean;
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
  tokenSource: FeishuTokenSource;
  config: FeishuConfig & FeishuAccountConfig;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * Feishu message types
 */
export type FeishuMessageType =
  | "text"
  | "post" // Rich text
  | "image"
  | "file"
  | "audio"
  | "media" // Video
  | "sticker"
  | "interactive" // Card
  | "share_chat"
  | "share_user";

/**
 * Text message content
 */
export interface FeishuTextContent {
  text: string;
}

/**
 * Rich text (post) message content
 */
export interface FeishuPostContent {
  title?: string;
  content: FeishuPostParagraph[][];
}

export interface FeishuPostParagraph {
  tag: "text" | "a" | "at" | "img" | "media" | "emotion";
  text?: string;
  href?: string;
  user_id?: string;
  image_key?: string;
  file_key?: string;
  emoji_type?: string;
}

/**
 * Image message content
 */
export interface FeishuImageContent {
  image_key: string;
}

/**
 * File message content
 */
export interface FeishuFileContent {
  file_key: string;
  file_name?: string;
}

/**
 * Interactive card message content
 */
export interface FeishuCardContent {
  config?: {
    wide_screen_mode?: boolean;
    enable_forward?: boolean;
  };
  header?: {
    title: {
      tag: "plain_text" | "lark_md";
      content: string;
    };
    template?: string; // Color template
  };
  elements: FeishuCardElement[];
}

export type FeishuCardElement =
  | FeishuCardDiv
  | FeishuCardMarkdown
  | FeishuCardAction
  | FeishuCardNote
  | FeishuCardDivider;

export interface FeishuCardDiv {
  tag: "div";
  text?: {
    tag: "plain_text" | "lark_md";
    content: string;
  };
  fields?: Array<{
    is_short: boolean;
    text: {
      tag: "plain_text" | "lark_md";
      content: string;
    };
  }>;
}

export interface FeishuCardMarkdown {
  tag: "markdown";
  content: string;
}

export interface FeishuCardAction {
  tag: "action";
  actions: Array<{
    tag: "button" | "select_static" | "overflow" | "date_picker";
    text?: {
      tag: "plain_text" | "lark_md";
      content: string;
    };
    type?: "default" | "primary" | "danger";
    value?: Record<string, unknown>;
    url?: string;
  }>;
}

export interface FeishuCardNote {
  tag: "note";
  elements: Array<{
    tag: "plain_text" | "lark_md" | "img";
    content?: string;
    img_key?: string;
  }>;
}

export interface FeishuCardDivider {
  tag: "hr";
}

// ============================================================================
// Webhook Event Types
// ============================================================================

/**
 * Feishu webhook event wrapper
 */
export interface FeishuWebhookEvent {
  schema?: string;
  header: {
    event_id: string;
    event_type: string;
    create_time: string;
    token: string;
    app_id: string;
    tenant_key: string;
  };
  event: FeishuEventPayload;
}

export type FeishuEventPayload =
  | FeishuMessageReceiveEvent
  | FeishuMessageReactionEvent
  | FeishuBotAddedEvent
  | FeishuBotRemovedEvent;

/**
 * Message receive event (im.message.receive_v1)
 */
export interface FeishuMessageReceiveEvent {
  sender: {
    sender_id: {
      union_id?: string;
      user_id?: string;
      open_id?: string;
    };
    sender_type: "user" | "app";
    tenant_key?: string;
  };
  message: {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    create_time: string;
    update_time?: string;
    chat_id: string;
    chat_type: "p2p" | "group";
    message_type: FeishuMessageType;
    content: string; // JSON string
    mentions?: Array<{
      key: string;
      id: {
        union_id?: string;
        user_id?: string;
        open_id?: string;
      };
      name: string;
      tenant_key?: string;
    }>;
  };
}

/**
 * Message reaction event
 */
export interface FeishuMessageReactionEvent {
  message_id: string;
  reaction_type: {
    emoji_type: string;
  };
  operator_type: "user";
  user_id: {
    union_id?: string;
    user_id?: string;
    open_id?: string;
  };
  action_time: string;
}

/**
 * Bot added to group event
 */
export interface FeishuBotAddedEvent {
  chat_id: string;
  operator_id: {
    union_id?: string;
    user_id?: string;
    open_id?: string;
  };
  external: boolean;
  operator_tenant_key: string;
}

/**
 * Bot removed from group event
 */
export interface FeishuBotRemovedEvent {
  chat_id: string;
  operator_id: {
    union_id?: string;
    user_id?: string;
    open_id?: string;
  };
  external: boolean;
  operator_tenant_key: string;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Inbound message context for processing
 */
export interface FeishuInboundContext {
  /** Message ID */
  messageId: string;
  /** Chat ID (conversation) */
  chatId: string;
  /** Chat type */
  chatType: "p2p" | "group";
  /** Sender's open_id */
  senderId: string;
  /** Sender's user_id (if available) */
  senderUserId?: string;
  /** Sender's display name */
  senderName?: string;
  /** Message type */
  messageType: FeishuMessageType;
  /** Message content (parsed) */
  content: unknown;
  /** Text content (extracted from various message types) */
  text?: string;
  /** Whether bot was mentioned */
  isMentioned: boolean;
  /** Mentions in the message */
  mentions?: Array<{
    key: string;
    id: string;
    name: string;
  }>;
  /** Media attachments */
  media?: Array<{
    type: "image" | "file" | "audio" | "video";
    key: string;
    name?: string;
    path?: string;
    contentType?: string;
  }>;
  /** Parent message ID (for replies) */
  parentId?: string;
  /** Root message ID (for threads) */
  rootId?: string;
  /** Raw event data */
  rawEvent: FeishuMessageReceiveEvent;
  /** Account configuration */
  account: ResolvedFeishuAccount;
  /** Timestamp */
  timestamp: number;
}

/**
 * Send result
 */
export interface FeishuSendResult {
  messageId: string;
  chatId: string;
}

/**
 * Probe result
 */
export interface FeishuProbeResult {
  ok: boolean;
  bot?: {
    appName?: string;
    openId?: string;
    avatarUrl?: string;
  };
  error?: string;
}

// ============================================================================
// Channel Data Types (for OpenClaw integration)
// ============================================================================

/**
 * Channel-specific data for message handling
 */
export interface FeishuChannelData {
  /** Send as card message */
  card?: FeishuCardContent;
  /** Send as rich text */
  richText?: FeishuPostContent;
  /** Quick reply buttons */
  quickReplies?: Array<{
    label: string;
    value: string;
  }>;
}
