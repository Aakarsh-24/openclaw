/**
 * Queue to Agent Dispatcher
 * Bridges the queue system with existing OpenClaw agent infrastructure
 */

import type { QueuedMessage, MessageProcessingResult } from './types.js';
import { loadConfig } from '../config/config.js';
import { formatForLog } from '../gateway/ws-log.js';

const AGENT_DISPATCH_TIMEOUT_MS = 60000; // 1 minute per message

/**
 * Dispatch a queued message to the OpenClaw agent system
 * This bridges the queue system with existing inline message processing
 */
export async function dispatchMessageToAgent(
  msg: QueuedMessage
): Promise<MessageProcessingResult> {
  const startTime = Date.now();

  try {
    console.log(`[Agent Dispatch] Dispatching message ${msg.id} to agent`);

    // Import and use existing message processing infrastructure
    const dispatchModule = await importChannelDispatchModule(msg.channel);

    if (!dispatchModule) {
      // If no specific dispatch module, use the generic approach
      return await dispatchGenericMessage(msg);
    }

    // Execute existing message dispatch logic with timeout
    await dispatchMessageWithTimeout(
      dispatchModule,
      msg,
      AGENT_DISPATCH_TIMEOUT_MS
    );

    const processingTime = Date.now() - startTime;
    console.log(`[Agent Dispatch] Successfully processed ${msg.id} in ${processingTime}ms`);

    return {
      success: true,
      processedAt: Date.now(),
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const processingTime = Date.now() - startTime;

    console.error(
      `[Agent Dispatch] Failed to process ${msg.id} after ${processingTime}ms:`,
      errorMsg
    );

    return {
      success: false,
      error: errorMsg,
      processedAt: Date.now(),
    };
  }
}

/**
 * Import the appropriate channel dispatch module
 */
async function importChannelDispatchModule(channel: string): Promise<any> {
  try {
    switch (channel) {
      case 'telegram':
        return await import('../telegram/bot-message-dispatch.js');
      case 'slack':
        // Slack is handled via extension system
        try {
          return await import('../../extensions/slack/dist/index.js');
        } catch {
          return null;
        }
      case 'discord':
        try {
          return await import('../../extensions/discord/dist/index.js');
        } catch {
          return null;
        }
      default:
        console.warn(
          `[Agent Dispatch] No specific dispatch module for ${channel}, using generic handler`
        );
        return null;
    }
  } catch (err) {
    console.error(
      `[Agent Dispatch] Failed to load dispatch module for ${channel}:`,
      err
    );
    return null;
  }
}

/**
 * Execute message dispatch with timeout
 */
async function dispatchMessageWithTimeout(
  dispatchModule: any,
  msg: QueuedMessage,
  timeoutMs: number
): Promise<void> {
  // Reconstruct the message context from metadata
  const ctx = msg.metadata?.ctx;

  if (!ctx) {
    throw new Error('Message context (ctx) not found in metadata');
  }

  // Call the existing dispatch function
  // Note: The exact function signature varies by channel
  // We'll use the most common pattern
  const dispatchFn = dispatchModule.dispatchMessage || dispatchModule.default;

  if (typeof dispatchFn !== 'function') {
    throw new Error('Dispatch module does not export a dispatch function');
  }

  // Execute with timeout
  return Promise.race([
    dispatchFn({ ctxPayload: ctx, ...msg.metadata }),
    new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Dispatch timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Generic message dispatch fallback
 * Used when no specific dispatch module is available
 */
async function dispatchGenericMessage(
  msg: QueuedMessage
): Promise<MessageProcessingResult> {
  console.log(`[Agent Dispatch] Using generic dispatch for ${msg.channel}`);

  // For generic dispatch, we'd need to trigger the agent directly
  // This is a simplified version that would need proper integration
  // TODO: Implement proper generic dispatch or fail fast

  throw new Error(
    `Generic dispatch not yet implemented for channel: ${msg.channel}. Please use inline mode.`
  );
}

/**
 * Process message directly (for compatibility with existing inline processing)
 * This allows switching between queue and inline modes
 */
export async function processMessageInline(
  channel: string,
  ctx: any,
  media: any[],
  text?: string
): Promise<void> {
  const msg: QueuedMessage = {
    id: generateInlineMessageId(channel),
    channel: channel as any,
    sessionKey: deriveSessionKeyFromContext(ctx),
    userId: deriveUserIdFromContext(ctx),
    text,
    media,
    timestamp: Date.now(),
    priority: 50,
    metadata: { ctx },
    retryCount: 0,
  };

  const result = await dispatchMessageToAgent(msg);

  if (!result.success) {
    throw new Error(result.error || 'Message processing failed');
  }
}

/**
 * Helper: Generate inline message ID
 */
function generateInlineMessageId(channel: string): string {
  return `${channel}_inline_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Helper: Derive session key from context
 */
function deriveSessionKeyFromContext(ctx: any): string {
  // Try common session key locations in context
  return (
    ctx.sessionKey ||
    ctx.session?.key ||
    ctx.key ||
    ctx.sessionId ||
    'unknown'
  );
}

/**
 * Helper: Derive user ID from context
 */
function deriveUserIdFromContext(ctx: any): string {
  // Try common user ID locations in context
  return (
    ctx.userId ||
    ctx.user?.id ||
    ctx.senderId ||
    ctx.from?.id ||
    ctx.message?.from?.id ||
    ctx.chat?.id ||
    'unknown'
  );
}

/**
 * Fallback: Format message for log
 */
export function formatQueuedMessageForLog(msg: QueuedMessage): string {
  return formatForLog({
    type: 'queued_message',
    id: msg.id,
    channel: msg.channel,
    userId: msg.userId,
    sessionKey: msg.sessionKey,
    priority: msg.priority,
    timestamp: new Date(msg.timestamp).toISOString(),
    textLength: msg.text?.length || 0,
    mediaCount: msg.media?.length || 0,
  });
}
