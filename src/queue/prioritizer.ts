/**
 * Message Priority Engine
 * Determines message priority based on configurable rules
 */

import type { PriorityRule, QueuedMessage, QueueConfig } from './types.js';

const DEFAULT_PRIORITY_RULES: PriorityRule[] = [
  {
    name: 'admin',
    condition: (msg, cfg) => cfg.priority.adminUsers.includes(msg.userId),
    priority: 0,
  },
  {
    name: 'owner',
    condition: (msg, cfg) => cfg.priority.ownerUserIds.includes(msg.userId),
    priority: 10,
  },
  {
    name: 'urgent_keyword',
    condition: (msg) => hasUrgentKeyword(msg.text, ['urgent', 'asap', 'emergency', 'critical', 'help!']),
    priority: 20,
  },
  {
    name: 'high_priority_keyword',
    condition: (msg) => hasUrgentKeyword(msg.text, ['important', 'priority', 'please']),
    priority: 30,
  },
  {
    name: 'media_message',
    condition: (msg) => msg.media && msg.media.length > 0,
    priority: 40,
  },
  {
    name: 'default',
    condition: () => true,
    priority: 50,
  },
];

const DEFAULT_URGENT_KEYWORDS = ['urgent', 'asap', 'emergency', 'critical', 'help!'];

/**
 * Determine priority for a message based on rules
 */
export function determinePriority(msg: QueuedMessage, cfg: QueueConfig): number {
  const rules = [...DEFAULT_PRIORITY_RULES];

  // Add custom keyword rules from config
  if (cfg.priority.urgentKeywords.length > 0) {
    rules.push({
      name: 'custom_urgent',
      condition: (m) => hasUrgentKeyword(m.text, cfg.priority.urgentKeywords),
      priority: 25, // Between urgent and high priority
    });
  }

  // Find the first matching rule (highest priority)
  for (const rule of rules) {
    if (rule.condition(msg, cfg)) {
      return rule.priority;
    }
  }

  return 50; // Default priority
}

/**
 * Check if message contains urgent keywords
 */
function hasUrgentKeyword(text: string | undefined, keywords: string[]): boolean {
  if (!text || keywords.length === 0) {
    return false;
  }

  const normalizedText = text.toLowerCase();
  return keywords.some(kw => {
    const normalizedKw = kw.toLowerCase().trim();
    return normalizedText.includes(normalizedKw);
  });
}

/**
 * Check if a user is an admin
 */
export function isAdminUser(userId: string, cfg: QueueConfig): boolean {
  return cfg.priority.adminUsers.includes(userId);
}

/**
 * Check if a user is an owner
 */
export function isOwnerUser(userId: string, cfg: QueueConfig): boolean {
  return cfg.priority.ownerUserIds.includes(userId);
}

/**
 * Get all priority rules (for debugging)
 */
export function getPriorityRules(): PriorityRule[] {
  return DEFAULT_PRIORITY_RULES;
}

/**
 * Calculate priority score for Redis sorted set
 * Higher priority messages get lower scores (processed first)
 * Format: {priority}.{timestamp}
 */
export function calculatePriorityScore(priority: number, timestamp: number): string {
  // Lower score = higher priority in Redis sorted set
  // Format: {priority}.{timestamp} where timestamp is inverted for FIFO within same priority
  const invertedTimestamp = Number.MAX_SAFE_INTEGER - timestamp;
  return `${priority}.${invertedTimestamp}`;
}

/**
 * Parse priority score back to priority value
 */
export function parsePriorityScore(score: string): number {
  const priority = parseInt(score.split('.')[0], 10);
  return isNaN(priority) ? 50 : priority;
}
