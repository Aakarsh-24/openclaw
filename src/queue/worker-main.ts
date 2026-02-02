#!/usr/bin/env node
/**
 * Queue Worker - Standalone Entry Point
 * Runs the message queue worker independently
 */

import { runWorkerAsStandalone } from './queue/worker.js';
import { loadConfig } from './config/config.js';

async function main() {
  const cfg = loadConfig();

  if (!cfg.queue?.enabled) {
    console.error('[Queue Worker] Queue system is not enabled in config');
    console.error('[Queue Worker] Set "queue.enabled": true in ~/.openclaw/config.json');
    process.exit(1);
  }

  console.log('[Queue Worker] Starting with config:', {
    redisUrl: cfg.queue.redis.url,
    maxConcurrency: cfg.queue.worker.maxConcurrency,
    pollIntervalMs: cfg.queue.worker.pollIntervalMs,
    maxRetries: cfg.queue.worker.maxRetries,
  });

  // Run worker
  await runWorkerAsStandalone(cfg.queue);
}

main().catch(err => {
  console.error('[Queue Worker] Fatal error:', err);
  process.exit(1);
});
