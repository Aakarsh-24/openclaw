/**
 * Queue Worker
 * Independently processes messages from the queue
 */

import type { QueuedMessage, WorkerConfig, MessageProcessingResult } from './types.js';
import { RedisQueueBackend } from './redisQueue.js';
import { emitWebhookEvent } from './webhooks.js';
import { dispatchMessageToAgent } from './agent-dispatcher.js';

const DEFAULT_MAX_CONCURRENCY = 5;
const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 5000;

export class QueueWorker {
  private backend: RedisQueueBackend;
  private running = false;
  private processingMessages = new Set<string>();
  private config: WorkerConfig;

  constructor(config: WorkerConfig) {
    this.config = {
      ...config,
      worker: {
        maxConcurrency: config.worker?.maxConcurrency || DEFAULT_MAX_CONCURRENCY,
        pollIntervalMs: config.worker?.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS,
        maxRetries: config.worker?.maxRetries || DEFAULT_MAX_RETRIES,
        retryDelayMs: config.worker?.retryDelayMs || DEFAULT_RETRY_DELAY_MS,
      },
    };
    this.backend = new RedisQueueBackend(this.config);
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log('[Queue Worker] Already running');
      return;
    }

    await this.backend.connect();
    this.running = true;

    console.log('[Queue Worker] Started with config:', {
      maxConcurrency: this.config.worker.maxConcurrency,
      pollIntervalMs: this.config.worker.pollIntervalMs,
      maxRetries: this.config.worker.maxRetries,
    });

    // Start processing loop
    await this.processLoop();
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    console.log('[Queue Worker] Stopping...');
    this.running = false;

    // Wait for current messages to finish processing
    while (this.processingMessages.size > 0) {
      console.log(`[Queue Worker] Waiting for ${this.processingMessages.size} messages to finish...`);
      await this.sleep(1000);
    }

    await this.backend.disconnect();
    console.log('[Queue Worker] Stopped');
  }

  /**
   * Main processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.running) {
      try {
        // Check if we can process more messages
        if (this.processingMessages.size >= this.config.worker.maxConcurrency) {
          await this.sleep(this.config.worker.pollIntervalMs);
          continue;
        }

        // Dequeue message
        const msg = await this.backend.dequeue();

        if (msg) {
          // Process message
          this.processingMessages.add(msg.id);
          this.processMessage(msg)
            .finally(() => {
              this.processingMessages.delete(msg.id);
            });
        } else {
          // No messages, sleep
          await this.sleep(this.config.worker.pollIntervalMs);
        }
      } catch (err) {
        console.error('[Queue Worker] Error in process loop:', err);
        await this.sleep(this.config.worker.pollIntervalMs);
      }
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(msg: QueuedMessage): Promise<void> {
    try {
      console.log(`[Queue Worker] Processing message ${msg.id} from ${msg.channel}`);

      // Emit processing event
      await emitWebhookEvent('message/processing', msg);

      // Dispatch to agent
      const result = await dispatchMessageToAgent(msg);

      if (result.success) {
        console.log(`[Queue Worker] Successfully processed ${msg.id}`);

        // Emit success event
        await emitWebhookEvent('message/processed', msg);

        // Remove from storage
        await this.backend.removeMessage(msg.id);
      } else {
        throw new Error(result.error || 'Unknown error processing message');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Queue Worker] Failed to process ${msg.id}:`, errorMsg);

      // Handle retry or DLQ
      await this.handleProcessingError(msg, errorMsg);
    }
  }

  /**
   * Handle processing errors with retry logic
   */
  private async handleProcessingError(
    msg: QueuedMessage,
    error: string
  ): Promise<void> {
    msg.retryCount++;

    if (msg.retryCount < this.config.worker.maxRetries) {
      // Retry the message
      console.log(
        `[Queue Worker] Retrying ${msg.id} (attempt ${msg.retryCount}/${this.config.worker.maxRetries})`
      );

      await this.sleep(this.config.worker.retryDelayMs);

      // Re-enqueue with updated retry count
      await this.backend.enqueue(msg);

      // Emit retry event
      await emitWebhookEvent('message/retried', msg);
    } else {
      // Max retries reached, move to DLQ
      console.log(`[Queue Worker] Moving ${msg.id} to DLQ after ${msg.retryCount} failures`);

      await this.backend.addToDLQ(msg, error);

      // Emit failed event
      await emitWebhookEvent('message/failed', msg, error);

      // Remove from main queue storage
      await this.backend.removeMessage(msg.id);
    }
  }

  /**
   * Get worker stats
   */
  async getStats(): Promise<{
    running: boolean;
    processingCount: number;
    queueDepth: number;
  }> {
    const queueDepth = await this.backend.getQueueDepth();

    return {
      running: this.running,
      processingCount: this.processingMessages.size,
      queueDepth,
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create and start a worker instance
 */
export async function startWorker(config: WorkerConfig): Promise<QueueWorker> {
  const worker = new QueueWorker(config);
  await worker.start();
  return worker;
}

/**
 * Run worker as standalone process
 */
export async function runWorkerAsStandalone(config: WorkerConfig): Promise<void> {
  const worker = new QueueWorker(config);

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Queue Worker] Received ${signal}, shutting down...`);
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start worker
  await worker.start();
}
