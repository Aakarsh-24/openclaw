/**
 * Queue Producer Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { QueuedMessage, QueueConfig } from '../types.js';
import {
  initProducer,
  stopProducer,
  enqueueMessage,
  isProducerReady,
} from '../producer.js';
import { determinePriority } from '../prioritizer.js';

describe('Queue Producer', () => {
  let testConfig: QueueConfig;

  beforeEach(() => {
    testConfig = {
      enabled: true,
      redis: {
        url: 'redis://localhost:6379',
        keyPrefix: 'test:queue',
      },
      priority: {
        adminUsers: ['admin-user'],
        ownerUserIds: ['owner-user'],
        urgentKeywords: ['urgent', 'critical'],
      },
      worker: {
        maxConcurrency: 5,
        pollIntervalMs: 100,
        maxRetries: 3,
        retryDelayMs: 5000,
      },
      webhooks: [],
    };
  });

  afterEach(async () => {
    await stopProducer();
  });

  describe('initialization', () => {
    it('should initialize producer when config enables queue', async () => {
      await initProducer(testConfig);
      expect(isProducerReady()).toBe(true);
    });

    it('should not initialize producer when queue is disabled', async () => {
      const disabledConfig = { ...testConfig, enabled: false };
      await initProducer(disabledConfig);
      expect(isProducerReady()).toBe(false);
    });
  });

  describe('enqueueMessage', () => {
    it('should enqueue a message and return message ID', async () => {
      await initProducer(testConfig);

      const messageId = await enqueueMessage(
        'telegram',
        'session-key-123',
        'user-456',
        'Test message',
        undefined,
        { testMetadata: 'value' }
      );

      expect(messageId).toBeDefined();
      expect(messageId).toMatch(/^telegram_/);
    });

    it('should enqueue message with media', async () => {
      await initProducer(testConfig);

      const media = [
        { path: '/tmp/test.jpg', contentType: 'image/jpeg' },
      ];

      const messageId = await enqueueMessage(
        'telegram',
        'session-key-123',
        'user-456',
        undefined,
        media,
        {}
      );

      expect(messageId).toBeDefined();
    });
  });

  describe('getQueueDepth', () => {
    it('should return current queue depth', async () => {
      await initProducer(testConfig);

      // Enqueue a few messages
      await enqueueMessage('telegram', 'session-1', 'user-1', 'msg1');
      await enqueueMessage('telegram', 'session-2', 'user-2', 'msg2');

      const depth = await getQueueDepth();
      expect(depth).toBeGreaterThan(0);
    });
  });
});
