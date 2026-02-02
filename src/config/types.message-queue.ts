/**
 * Message Queue System Configuration Types
 */

export type WebhookEventType =
  | "message/queued"
  | "message/processing"
  | "message/processed"
  | "message/failed"
  | "message/retried";

export type WebhookConfig = {
  url: string;
  secret: string;
  events: WebhookEventType[];
};

export type QueuePriorityConfig = {
  adminUsers: string[];
  ownerUserIds: string[];
  urgentKeywords: string[];
};

export type QueueWorkerConfig = {
  maxConcurrency: number;
  pollIntervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
};

export type QueueRedisConfig = {
  url: string;
  keyPrefix: string;
  password?: string;
};

export type MessageQueueConfig = {
  enabled: boolean;
  redis: QueueRedisConfig;
  priority: QueuePriorityConfig;
  worker: QueueWorkerConfig;
  webhooks: WebhookConfig[];
};
