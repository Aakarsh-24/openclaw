/**
 * Webhook System
 * Emits events to configured webhook endpoints
 */

import type { WebhookConfig, WebhookEventPayload, WebhookEventType } from './types.js';
import { loadConfig } from '../config/config.js';

const WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Emit a webhook event to all configured endpoints
 */
export async function emitWebhookEvent(
  type: WebhookEventType,
  message: any,
  error?: string
): Promise<void> {
  const cfg = loadConfig();
  const queueConfig = cfg.queue;

  if (!queueConfig?.enabled || queueConfig.webhooks.length === 0) {
    return;
  }

  const payload: WebhookEventPayload = {
    type,
    message,
    timestamp: Date.now(),
    error,
  };

  // Emit to all webhooks asynchronously
  const promises = queueConfig.webhooks
    .filter(webhook => webhook.events.includes(type))
    .map(webhook => sendWebhook(webhook, payload));

  // Don't wait for webhooks to complete (fire and forget)
  Promise.allSettled(promises).catch(err => {
    console.error('[Webhook] Error emitting events:', err);
  });
}

/**
 * Send a webhook to a single endpoint
 */
async function sendWebhook(
  webhook: WebhookConfig,
  payload: WebhookEventPayload
): Promise<void> {
  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': webhook.secret,
        'X-Webhook-Type': payload.type,
        'User-Agent': 'OpenClaw-Queue/1.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        `[Webhook] Failed to send to ${webhook.url}: ${response.status} ${response.statusText}`
      );
    }
  } catch (err) {
    console.error(`[Webhook] Error sending to ${webhook.url}:`, err);
  }
}

/**
 * Validate webhook signature
 */
export function validateWebhookSignature(
  receivedSecret: string,
  expectedSecret: string
): boolean {
  return receivedSecret === expectedSecret;
}

/**
 * Test webhook connectivity
 */
export async function testWebhook(webhook: WebhookConfig): Promise<{
  success: boolean;
  error?: string;
  responseTime?: number;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': webhook.secret,
        'X-Webhook-Test': 'true',
      },
      body: JSON.stringify({
        type: 'test',
        timestamp: Date.now(),
      }),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        responseTime,
      };
    }

    return { success: true, responseTime };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      responseTime: Date.now() - startTime,
    };
  }
}
