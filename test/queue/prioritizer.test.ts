/**
 * Queue Prioritizer Tests
 */

import { describe, it, expect } from 'vitest';
import type { QueuedMessage, QueueConfig } from '../types.js';
import {
  determinePriority,
  isAdminUser,
  isOwnerUser,
  getPriorityRules,
} from '../prioritizer.js';

describe('Queue Prioritizer', () => {
  const baseConfig: QueueConfig = {
    enabled: true,
    redis: { url: 'redis://localhost', keyPrefix: 'test' },
    priority: {
      adminUsers: ['admin-123', 'admin-456'],
      ownerUserIds: ['owner-789'],
      urgentKeywords: ['urgent', 'critical', 'help!'],
    },
    worker: {
      maxConcurrency: 5,
      pollIntervalMs: 100,
      maxRetries: 3,
      retryDelayMs: 5000,
    },
    webhooks: [],
  };

  describe('determinePriority', () => {
    it('should assign priority 0 (highest) to admin users', () => {
      const msg: QueuedMessage = {
        id: 'test-1',
        channel: 'telegram',
        sessionKey: 'session-1',
        userId: 'admin-123',
        text: 'test message',
        timestamp: Date.now(),
        priority: 50,
        metadata: {},
        retryCount: 0,
      };

      const priority = determinePriority(msg, baseConfig);
      expect(priority).toBe(0);
    });

    it('should assign priority 10 to owner users', () => {
      const msg: QueuedMessage = {
        id: 'test-2',
        channel: 'telegram',
        sessionKey: 'session-2',
        userId: 'owner-789',
        text: 'test message',
        timestamp: Date.now(),
        priority: 50,
        metadata: {},
        retryCount: 0,
      };

      const priority = determinePriority(msg, baseConfig);
      expect(priority).toBe(10);
    });

    it('should assign priority 20 for urgent keywords', () => {
      const urgentKeywords = ['urgent', 'critical', 'asap', 'help!'];

      for (const keyword of urgentKeywords) {
        const msg: QueuedMessage = {
          id: `test-${keyword}`,
          channel: 'telegram',
          sessionKey: 'session-3',
          userId: 'user-999',
          text: keyword,
          timestamp: Date.now(),
          priority: 50,
          metadata: {},
          retryCount: 0,
        };

        const priority = determinePriority(msg, baseConfig);
        expect(priority).toBe(20);
      }
    });

    it('should assign priority 50 (default) to normal messages', () => {
      const msg: QueuedMessage = {
        id: 'test-4',
        channel: 'telegram',
        sessionKey: 'session-4',
        userId: 'user-999',
        text: 'normal message',
        timestamp: Date.now(),
        priority: 50,
        metadata: {},
        retryCount: 0,
      };

      const priority = determinePriority(msg, baseConfig);
      expect(priority).toBe(50);
    });

    it('should be case-insensitive for keyword matching', () => {
      const msg: QueuedMessage = {
        id: 'test-5',
        channel: 'telegram',
        sessionKey: 'session-5',
        userId: 'user-999',
        text: 'This is URGENT',
        timestamp: Date.now(),
        priority: 50,
        metadata: {},
        retryCount: 0,
      };

      const priority = determinePriority(msg, baseConfig);
      expect(priority).toBe(20);
    });

    it('should use custom urgent keywords from config', () => {
      const customConfig: QueueConfig = {
        ...baseConfig,
        priority: {
          ...baseConfig.priority,
          urgentKeywords: ['custom-keyword'],
        },
      };

      const msg: QueuedMessage = {
        id: 'test-6',
        channel: 'telegram',
        sessionKey: 'session-6',
        userId: 'user-999',
        text: 'This is a custom-keyword message',
        timestamp: Date.now(),
        priority: 50,
        metadata: {},
        retryCount: 0,
      };

      const priority = determinePriority(msg, customConfig);
      expect(priority).toBe(25); // Custom urgent priority
    });
  });

  describe('isAdminUser', () => {
    it('should return true for admin users', () => {
      const result = isAdminUser('admin-123', baseConfig);
      expect(result).toBe(true);
    });

    it('should return false for non-admin users', () => {
      const result = isAdminUser('user-999', baseConfig);
      expect(result).toBe(false);
    });
  });

  describe('isOwnerUser', () => {
    it('should return true for owner users', () => {
      const result = isOwnerUser('owner-789', baseConfig);
      expect(result).toBe(true);
    });

    it('should return false for non-owner users', () => {
      const result = isOwnerUser('user-999', baseConfig);
      expect(result).toBe(false);
    });
  });

  describe('getPriorityRules', () => {
    it('should return array of priority rules', () => {
      const rules = getPriorityRules();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0]).toHaveProperty('name');
      expect(rules[0]).toHaveProperty('condition');
      expect(rules[0]).toHaveProperty('priority');
    });
  });
});
