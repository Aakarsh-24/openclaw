/**
 * Queue Producer
 * Receives inbound messages and enqueues them
 */

import { v4 as uuidv4 } from 'uuid';
import type { QueuedMessage, QueueConfig } from './types.js';
import { RedisQueueBackend } from './redisQueue.js';
import { determinePriority } from './prioritizer.js';
import { emitWebhookEvent } from './webhooks.js';

const DEFAULT_PRIORITY = 50;

let queueBackend: RedisQueueBackend | null = null;
let config: QueueConfig | null = null;

/**
 * Initialize the queue producer
 */
export async function initProducer(cfg: QueueConfig): Promise<void> {
  if (!cfg.enabled) {
    console.log('[Queue Producer] Queue system is disabled');
    return;
  }

  config = cfg;
  queueBackend = new RedisQueueBackend(cfg);
  await queueBackend.connect();

  console.log('[Queue Producer] Initialized');
}

/**
 * Stop the queue producer
 */
export async function stopProducer(): Promise<void> {
  if (queueBackend) {
    await queueBackend.disconnect();
    queueBackend = null;
  }
  config = null;
}

/**
 * Check if producer is ready
 */
export function isProducerReady(): boolean {
  return queueBackend !== null && queueBackend?.isConnected();
}

/**
 * Enqueue a message from a channel
 */
export async function enqueueMessage(
  channel: string,
  sessionKey: string,
  userId: string,
  text: string | undefined,
  media: any[] | undefined,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  if (!config || !queueBackend) {
    throw new Error('Queue producer not initialized');
  }

  const messageId = generateMessageId(channel);

  const msg: QueuedMessage = {
    id: messageId,
    channel: channel as any,
    sessionKey,
    userId,
    text,
    media: normalizeMedia(media),
    timestamp: Date.now(),
    priority: DEFAULT_PRIORITY, // Will be updated by prioritizer
    metadata,
    retryCount: 0,
  };

  // Determine and set priority
  msg.priority = determinePriority(msg, config);

  // Enqueue to Redis
  await queueBackend.enqueue(msg);

  // Emit webhook
  await emitWebhookEvent('message/queued', msg);

  return messageId;
}

/**
 * Enqueue a pre-constructed message object
 */
export async function enqueueRawMessage(msg: QueuedMessage): Promise<void> {
  if (!config || !queueBackend) {
    throw new Error('Queue producer not initialized');
  }

  // Determine priority if not set
  if (msg.priority === undefined || msg.priority === 50) {
    msg.priority = determinePriority(msg, config);
  }

  // Ensure ID is set
  if (!msg.id) {
    msg.id = generateMessageId(msg.channel);
  }

  // Enqueue
  await queueBackend.enqueue(msg);

  // Emit webhook
  await emitWebhookEvent('message/queued', msg);
}

/**
 * Get current queue depth
 */
export async function getQueueDepth(): Promise<number> {
  if (!queueBackend) {
    throw new Error('Queue producer not initialized');
  }
  return queueBackend.getQueueDepth();
}

/**
 * Get message by ID
 */
export async function getMessage(messageId: string): Promise<QueuedMessage | null> {
  if (!queueBackend) {
    throw new Error('Queue producer not initialized');
  }
  return queueBackend.getMessage(messageId);
}

/**
 * Generate a unique message ID
 */
function generateMessageId(channel: string): string {
  const timestamp = Date.now().toString(36);
  const random = uuidv4().substring(0, 8);
  return `${channel}_${timestamp}_${random}`;
}

/**
 * Normalize media objects to MediaFile format
 */
function normalizeMedia(media: any[] | undefined): any[] | undefined {
  if (!media || media.length === 0) {
    return undefined;
  }

  return media.map(m => ({
    path: m.path || '',
    contentType: m.contentType,
    filename: m.filename,
    sizeBytes: m.sizeBytes,
  }));
}
