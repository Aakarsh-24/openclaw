/**
 * Queue CLI Commands
 * Manage and monitor the message queue system
 */

import { Command } from 'commander';
import { loadConfig } from '../config/config.js';
import type { QueueConfig, WorkerConfig } from './types.js';
import {
  initProducer,
  stopProducer,
  isProducerReady,
  enqueueMessage,
  getQueueDepth,
} from './producer.js';
import { RedisQueueBackend } from './redisQueue.js';
import { startWorker, runWorkerAsStandalone, QueueWorker } from './worker.js';
import { testWebhook } from './webhooks.js';

export function registerQueueCommands(program: Command): void {
  const queueCmd = program
    .command('queue')
    .description('Manage the message queue system');

  // Status command
  queueCmd
    .command('status')
    .description('Show queue status and statistics')
    .action(async () => {
      await showQueueStatus();
    });

  // Start worker command
  queueCmd
    .command('worker')
    .description('Start the queue worker (standalone)')
    .option('-c, --concurrency <number>', 'Max concurrent messages', '5')
    .option('-i, --interval <ms>', 'Poll interval in milliseconds', '100')
    .action(async (options) => {
      const cfg = loadConfig();
      if (!cfg.queue?.enabled) {
        console.error('Queue system is disabled in config');
        process.exit(1);
      }

      const workerConfig: WorkerConfig = {
        ...cfg.queue,
        worker: {
          ...cfg.queue.worker,
          maxConcurrency: parseInt(options.concurrency, 10),
          pollIntervalMs: parseInt(options.interval, 10),
        },
      };

      await runWorkerAsStandalone(workerConfig);
    });

  // Test webhook command
  queueCmd
    .command('test-webhook <url> <secret>')
    .description('Test webhook connectivity')
    .action(async (url, secret) => {
      const result = await testWebhook({ url, secret, events: ['test'] });

      if (result.success) {
        console.log(`✓ Webhook test successful (${result.responseTime}ms)`);
        process.exit(0);
      } else {
        console.error(`✗ Webhook test failed: ${result.error}`);
        process.exit(1);
      }
    });

  // List DLQ command
  queueCmd
    .command('dlq')
    .description('Show dead letter queue (failed messages)')
    .option('-l, --limit <number>', 'Number of entries to show', '10')
    .action(async (options) => {
      await showDLQEntries(parseInt(options.limit, 10));
    });

  // Retry DLQ command
  queueCmd
    .command('retry <messageId>')
    .description('Retry a failed message from DLQ')
    .action(async (messageId) => {
      await retryFromDLQ(messageId);
    });

  // Clear queue command
  queueCmd
    .command('clear')
    .description('Clear all queued messages (danger!)')
    .option('--force', 'Confirm without prompt')
    .action(async (options) => {
      await clearQueue(options.force);
    });

  // Health check command
  queueCmd
    .command('health')
    .description('Check queue system health')
    .action(async () => {
      await checkQueueHealth();
    });
}

/**
 * Show queue status
 */
async function showQueueStatus(): Promise<void> {
  const cfg = loadConfig();

  console.log('=== OpenClaw Message Queue Status ===\n');

  if (!cfg.queue?.enabled) {
    console.log('Queue system: DISABLED');
    console.log('\nEnable in config with queue.enabled = true');
    return;
  }

  console.log('Queue system: ENABLED');
  console.log('Redis URL:', maskUrl(cfg.queue.redis.url));
  console.log('Key prefix:', cfg.queue.redis.keyPrefix);

  try {
    const backend = new RedisQueueBackend(cfg.queue);
    await backend.connect();

    const depth = await backend.getQueueDepth();
    const dlqCount = await backend.getDLQEntries().then(entries => entries.length);

    console.log(`\nQueue depth: ${depth} messages`);
    console.log(`Dead letter queue: ${dlqCount} messages`);

    await backend.disconnect();
  } catch (err) {
    console.error('\nError connecting to Redis:', err);
    process.exit(1);
  }

  console.log('\nPriority rules:');
  console.log('  - Admin users:', cfg.queue.priority.adminUsers.join(', ') || 'None');
  console.log('  - Owner users:', cfg.queue.priority.ownerUserIds.join(', ') || 'None');
  console.log(
    '  - Urgent keywords:',
    cfg.queue.priority.urgentKeywords.join(', ') || 'None'
  );

  console.log('\nWebhooks:', cfg.queue.webhooks.length);
  cfg.queue.webhooks.forEach((wh, i) => {
    console.log(`  ${i + 1}. ${maskUrl(wh.url)} (${wh.events.length} events)`);
  });
}

/**
 * Show DLQ entries
 */
async function showDLQEntries(limit: number): Promise<void> {
  const cfg = loadConfig();

  if (!cfg.queue?.enabled) {
    console.error('Queue system is disabled');
    process.exit(1);
  }

  try {
    const backend = new RedisQueueBackend(cfg.queue);
    await backend.connect();

    const entries = await backend.getDLQEntries(limit);

    if (entries.length === 0) {
      console.log('Dead letter queue is empty');
      await backend.disconnect();
      return;
    }

    console.log(`=== Dead Letter Queue (${entries.length} entries) ===\n`);

    entries.forEach((entry, i) => {
      console.log(`${i + 1}. ${entry.id}`);
      console.log(`   Channel: ${entry.channel}`);
      console.log(`   User: ${entry.userId}`);
      console.log(`   Retries: ${entry.retryCount}`);
      console.log(`   Failed: ${entry.text?.substring(0, 50) || '[no text]'}...`);
      console.log(`   Error: ${entry.error.substring(0, 100)}`);
      console.log('');
    });

    await backend.disconnect();
  } catch (err) {
    console.error('Error fetching DLQ:', err);
    process.exit(1);
  }
}

/**
 * Retry message from DLQ
 */
async function retryFromDLQ(messageId: string): Promise<void> {
  const cfg = loadConfig();

  if (!cfg.queue?.enabled) {
    console.error('Queue system is disabled');
    process.exit(1);
  }

  try {
    const backend = new RedisQueueBackend(cfg.queue);
    await backend.connect();

    await backend.retryFromDLQ(messageId);

    console.log(`✓ Message ${messageId} requeued for processing`);

    await backend.disconnect();
  } catch (err) {
    console.error('Error retrying message:', err);
    process.exit(1);
  }
}

/**
 * Clear queue
 */
async function clearQueue(force: boolean): Promise<void> {
  const cfg = loadConfig();

  if (!cfg.queue?.enabled) {
    console.error('Queue system is disabled');
    process.exit(1);
  }

  if (!force) {
    console.warn('This will clear ALL queued messages. Data will be lost!');
    console.warn('Use --force to confirm.');
    process.exit(1);
  }

  try {
    const backend = new RedisQueueBackend(cfg.queue);
    await backend.connect();

    const depth = await backend.getQueueDepth();
    await backend.clearAll();

    console.log(`✓ Cleared ${depth} messages from queue`);

    await backend.disconnect();
  } catch (err) {
    console.error('Error clearing queue:', err);
    process.exit(1);
  }
}

/**
 * Check queue health
 */
async function checkQueueHealth(): Promise<void> {
  const cfg = loadConfig();

  if (!cfg.queue?.enabled) {
    console.log('Status: DISABLED');
    process.exit(0);
  }

  let healthy = true;
  const checks: Array<{ name: string; passed: boolean; message?: string }> = [];

  // Check Redis connection
  try {
    const backend = new RedisQueueBackend(cfg.queue);
    await backend.connect();
    await backend.disconnect();
    checks.push({ name: 'Redis connection', passed: true });
  } catch (err) {
    healthy = false;
    checks.push({
      name: 'Redis connection',
      passed: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Check config
  if (!cfg.queue.redis.url) {
    healthy = false;
    checks.push({ name: 'Redis URL', passed: false, message: 'Not configured' });
  } else {
    checks.push({ name: 'Redis URL', passed: true });
  }

  console.log('=== Queue Health Check ===\n');

  checks.forEach(check => {
    const status = check.passed ? '✓' : '✗';
    console.log(`${status} ${check.name}`);
    if (check.message) {
      console.log(`  ${check.message}`);
    }
  });

  console.log(`\nStatus: ${healthy ? 'HEALTHY' : 'UNHEALTHY'}`);

  process.exit(healthy ? 0 : 1);
}

/**
 * Mask URL for display
 */
function maskUrl(url: string): string {
  if (!url) return '[not set]';

  try {
    const urlObj = new URL(url);
    if (urlObj.password) {
      urlObj.password = '****';
    }
    return urlObj.toString();
  } catch {
    return url;
  }
}
