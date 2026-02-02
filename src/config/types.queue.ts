/**
 * Queue Configuration Types
 */

import { z } from 'zod';

export const MessageQueueConfigSchema = z.object({
  enabled: z.boolean().default(false),
  redis: z.object({
    url: z.string().url().default('redis://localhost:6379'),
    keyPrefix: z.string().default('openclaw:queue'),
    password: z.string().optional(),
  }),
  priority: z.object({
    adminUsers: z.array(z.string()).default([]),
    ownerUserIds: z.array(z.string()).default([]),
    urgentKeywords: z.array(z.string()).default([
      'urgent',
      'asap',
      'emergency',
      'critical',
    ]),
  }),
  worker: z.object({
    maxConcurrency: z.number().int().min(1).default(5),
    pollIntervalMs: z.number().int().min(10).default(100),
    maxRetries: z.number().int().min(0).default(3),
    retryDelayMs: z.number().int().min(1000).default(5000),
  }),
  webhooks: z
    .array(
      z.object({
        url: z.string().url(),
        secret: z.string().min(16),
        events: z.array(z.string()),
      })
    )
    .default([]),
});

export type QueueConfig = z.infer<typeof QueueConfigSchema>;
