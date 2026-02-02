/**
 * Message Queue System - Type Definitions
 */

export type ChannelType = 'telegram' | 'whatsapp' | 'slack' | 'discord' | 'googlechat' | 'signal' | 'imessage' | 'msteams' | 'webchat' | 'matrix' | 'zalo';

export type WebhookEventType = 'message/queued' | 'message/processing' | 'message/processed' | 'message/failed' | 'message/retried';

export interface MediaFile {
  path: string;
  contentType?: string;
  filename?: string;
  sizeBytes?: number;
}

export interface QueuedMessage {
  id: string;
  channel: ChannelType;
  sessionKey: string;
  userId: string;
  text?: string;
  media?: MediaFile[];
  timestamp: number;
  priority: number;
  metadata: Record<string, unknown>;
  retryCount: number;
}

export interface PriorityRule {
  name: string;
  condition: (msg: QueuedMessage) => boolean;
  priority: number; // 0 (highest) - 100 (lowest)
}

export interface WebhookConfig {
  url: string;
  secret: string;
  events: WebhookEventType[];
}

export interface WebhookEventPayload {
  type: WebhookEventType;
  message: QueuedMessage;
  timestamp: number;
  error?: string;
}

export interface QueueConfig {
  enabled: boolean;
  redis: {
    url: string;
    keyPrefix: string;
    password?: string;
  };
  priority: {
    adminUsers: string[];
    ownerUserIds: string[];
    urgentKeywords: string[];
  };
  worker: {
    maxConcurrency: number;
    pollIntervalMs: number;
    maxRetries: number;
    retryDelayMs: number;
  };
  webhooks: WebhookConfig[];
}

export interface WorkerConfig extends QueueConfig {
  channel?: ChannelType; // Optional: worker can be channel-specific
}

export interface MessageProcessingResult {
  success: boolean;
  error?: string;
  processedAt: number;
}

export interface DeadLetterEntry extends QueuedMessage {
  error: string;
  failedAt: number;
}
