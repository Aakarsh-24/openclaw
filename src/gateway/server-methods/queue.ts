/**
 * Queue Server Methods
 * Gateway HTTP API endpoints for queue management
 */

import type { QueueConfig, WorkerConfig, WebhookConfig } from '../queue/types.js';
import {
  initProducer,
  stopProducer,
  isProducerReady,
  getQueueDepth,
  getMessage,
} from '../queue/index.js';
import { loadConfig, writeConfigFile } from '../config/config.js';

/**
 * Get queue system status
 */
export async function getQueueStatus() {
  const cfg = loadConfig();
  const queueConfig = cfg.queue;

  return {
    enabled: queueConfig?.enabled || false,
    producerReady: isProducerReady(),
    config: sanitizeConfig(queueConfig),
  };
}

/**
 * Enable queue system
 */
export async function enableQueue(config: Partial<QueueConfig>): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const cfg = loadConfig();

    if (!cfg.queue) {
      cfg.queue = createDefaultQueueConfig();
    }

    // Merge provided config
    cfg.queue = {
      ...cfg.queue,
      ...config,
      enabled: true,
    };

    // Write updated config
    await writeConfigFile(cfg);

    // Initialize producer
    if (!isProducerReady()) {
      await initProducer(cfg.queue);
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Disable queue system
 */
export async function disableQueue(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const cfg = loadConfig();

    if (cfg.queue) {
      cfg.queue.enabled = false;
      await writeConfigFile(cfg);
    }

    // Stop producer
    await stopProducer();

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Get queue metrics
 */
export async function getQueueMetrics() {
  const queueConfig = loadConfig().queue;

  if (!queueConfig?.enabled || !isProducerReady()) {
    return {
      enabled: false,
      queueDepth: 0,
    };
  }

  const depth = await getQueueDepth();

  return {
    enabled: true,
    queueDepth: depth,
  };
}

/**
 * Add webhook configuration
 */
export async function addWebhook(
  webhook: WebhookConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const cfg = loadConfig();

    if (!cfg.queue) {
      return {
        success: false,
        error: 'Queue system is not enabled',
      };
    }

    if (!cfg.queue.webhooks) {
      cfg.queue.webhooks = [];
    }

    // Check for duplicate URL
    if (cfg.queue.webhooks.some(w => w.url === webhook.url)) {
      return {
        success: false,
        error: 'Webhook with this URL already exists',
      };
    }

    // Add webhook
    cfg.queue.webhooks.push(webhook);
    await writeConfigFile(cfg);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Remove webhook configuration
 */
export async function removeWebhook(url: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const cfg = loadConfig();

    if (!cfg.queue?.webhooks) {
      return { success: true }; // Nothing to remove
    }

    // Remove webhook by URL
    cfg.queue.webhooks = cfg.queue.webhooks.filter(w => w.url !== url);

    await writeConfigFile(cfg);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * List webhooks
 */
export async function listWebhooks(): Promise<WebhookConfig[]> {
  const cfg = loadConfig();
  return cfg.queue?.webhooks || [];
}

/**
 * Test webhook connectivity
 */
export async function testWebhook(url: string): Promise<{
  success: boolean;
  error?: string;
  responseTime?: number;
}> {
  const { testWebhook: testFn } = await import('../queue/webhooks.js');

  const webhooks = await listWebhooks();
  const webhook = webhooks.find(w => w.url === url);

  if (!webhook) {
    return {
      success: false,
      error: 'Webhook not found',
    };
  }

  return await testFn(webhook);
}

/**
 * Update priority configuration
 */
export async function updatePriorityConfig(
  config: {
    adminUsers?: string[];
    ownerUserIds?: string[];
    urgentKeywords?: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const cfg = loadConfig();

    if (!cfg.queue) {
      return {
        success: false,
        error: 'Queue system is not enabled',
      };
    }

    // Update priority config
    if (config.adminUsers !== undefined) {
      cfg.queue.priority.adminUsers = config.adminUsers;
    }
    if (config.ownerUserIds !== undefined) {
      cfg.queue.priority.ownerUserIds = config.ownerUserIds;
    }
    if (config.urgentKeywords !== undefined) {
      cfg.queue.priority.urgentKeywords = config.urgentKeywords;
    }

    await writeConfigFile(cfg);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Get priority configuration
 */
export async function getPriorityConfig() {
  const cfg = loadConfig();
  return cfg.queue?.priority || createDefaultQueueConfig().priority;
}

/**
 * Create default queue configuration
 */
function createDefaultQueueConfig(): QueueConfig {
  return {
    enabled: false,
    redis: {
      url: 'redis://localhost:6379',
      keyPrefix: 'openclaw:queue',
    },
    priority: {
      adminUsers: [],
      ownerUserIds: [],
      urgentKeywords: ['urgent', 'asap', 'emergency', 'critical'],
    },
    worker: {
      maxConcurrency: 5,
      pollIntervalMs: 100,
      maxRetries: 3,
      retryDelayMs: 5000,
    },
    webhooks: [],
  };
}

/**
 * Sanitize config for output (remove sensitive data)
 */
function sanitizeConfig(config?: QueueConfig): any {
  if (!config) {
    return null;
  }

  return {
    ...config,
    redis: {
      ...config.redis,
      password: '***' if (config.redis.password) else undefined,
    },
  };
}
