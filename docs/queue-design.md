# OpenClaw Message Queue System - Design Document

## Executive Summary

This document describes the design and implementation of a robust, production-ready message queue system for OpenClaw. The queue system enhances how messages are received, processed, prioritized, and delivered across multiple channels (Telegram, WhatsApp, Slack, Discord, etc.).

## Goals

1. **Reliability**: Ensure no messages are lost during system failures
2. **Scalability**: Handle high message throughput across multiple channels
3. **Prioritization**: Process critical messages first (admin, urgent, etc.)
4. **Durability**: Persist messages in Redis for recovery
5. **Asynchronous Processing**: Decouple message ingestion from processing
6. **Observability**: Webhook events for monitoring and integration

## Current Architecture

### Existing Message Flow

```
Channel (Telegram/WhatsApp/Slack)
    ↓
Channel Handler (bot-handlers.ts / plugin handlers)
    ↓
Message Debouncer (inbound-debouncer.ts)
    ↓
Process Message (processMessage / dispatchTelegramMessage)
    ↓
Agent (Embedded AI Runtime)
    ↓
Response Delivered back to Channel
```

### Key Components

- **Channel Adapters**: `src/telegram/`, `src/channels/plugins/`, `extensions/*/`
- **Gateway**: `src/gateway/` - manages sessions, routing
- **Agent**: `src/agents/` - Embedded AI runtime
- **Message Processing**: Inline, synchronous processing

## Proposed Architecture

### New Message Flow with Queue

```
Channel (Telegram/WhatsApp/Slack)
    ↓
Channel Handler
    ↓
Queue Producer (enqueue message to Redis)
    ↓
Redis (Priority Sorted Set + Streams)
    ↓
Queue Worker (dequeue and process)
    ↓
Agent (Embedded AI Runtime)
    ↓
Response Delivered
    ↓
Webhook Events (queued/processed/failed)
```

### Components

#### 1. Queue Producer (`src/queue/producer.ts`)

Receives inbound messages and enqueues them with priority.

```typescript
export interface QueuedMessage {
  id: string;                    // Unique message ID
  channel: string;               // telegram, whatsapp, slack, etc.
  sessionKey: string;           // OpenClaw session key
  userId: string;                // User identifier
  text?: string;                // Message text
  media?: MediaFile[];          // Attached media
  timestamp: number;            // Epoch timestamp
  priority: number;             // Priority score (0-100)
  metadata: Record<string, unknown>; // Additional context
  retryCount: number;           // Retry counter (0)
}

export async function enqueueMessage(msg: QueuedMessage): Promise<string> {
  const priority = determinePriority(msg);
  await addToPriorityQueue('messages', priority, msg.id, msg);
  await emitWebhookEvent('message/queued', msg);
  return msg.id;
}
```

#### 2. Redis Queue Backend (`src/queue/redisQueue.ts`)

Manages Redis data structures for the queue.

```typescript
// Priority Queue using Sorted Sets
// ZADD queue:{priority} {timestamp} {messageId}
// ZRANGEBYSCORE queue:{priority} -inf {current_timestamp}

// Queue Data Storage
// HSET message:{messageId} {json_data}

// Message Processing Stream (for consumer groups)
// XADD processing:stream * {messageId} {status} {timestamp}
```

Features:
- **Priority Queue**: Sorted sets for each priority level
- **Message Storage**: Hash for message data
- **Processing Tracking**: Streams for consumer groups
- **Dead Letter Queue**: Failed messages with retry info

#### 3. Prioritizer (`src/queue/prioritizer.ts`)

Determines message priority based on rules.

```typescript
export interface PriorityRule {
  name: string;
  condition: (msg: QueuedMessage) => boolean;
  priority: number; // 0 (highest) - 100 (lowest)
}

const DEFAULT_RULES: PriorityRule[] = [
  {
    name: 'admin',
    condition: (msg) => isAdminUser(msg.userId),
    priority: 0,
  },
  {
    name: 'urgent_keyword',
    condition: (msg) => hasUrgentKeyword(msg.text),
    priority: 10,
  },
  {
    name: 'owner',
    condition: (msg) => isOwnerUser(msg.userId),
    priority: 20,
  },
  {
    name: 'default',
    condition: () => true,
    priority: 50,
  },
];

export function determinePriority(msg: QueuedMessage): number {
  for (const rule of PRIORITY_RULES) {
    if (rule.condition(msg)) {
      return rule.priority;
    }
  }
  return 50;
}

function hasUrgentKeyword(text?: string): boolean {
  if (!text) return false;
  const keywords = ['urgent', 'asap', 'emergency', 'critical', 'help!'];
  return keywords.some(kw => text.toLowerCase().includes(kw));
}
```

#### 4. Queue Worker (`src/queue/worker.ts`)

Independent worker that processes the queue.

```typescript
export interface WorkerConfig {
  redisUrl: string;
  maxConcurrency: number;     // Parallel message processing
  pollIntervalMs: number;      // Queue check interval
  maxRetries: number;         // Retry attempts
  retryDelayMs: number;        // Delay between retries
}

export class QueueWorker {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
    while (this.running) {
      const msg = await this.dequeueMessage();
      if (msg) {
        await this.processMessage(msg);
      } else {
        await sleep(this.config.pollIntervalMs);
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  private async processMessage(msg: QueuedMessage): Promise<void> {
    try {
      await emitWebhookEvent('message/processing', msg);

      // Route to existing message dispatcher
      await dispatchToAgent(msg);

      await emitWebhookEvent('message/processed', msg);
      await removeMessage(msg.id);
    } catch (err) {
      if (msg.retryCount < this.config.maxRetries) {
        await this.retryMessage(msg);
      } else {
        await this.moveToDeadLetterQueue(msg, err);
      }
    }
  }
}
```

#### 5. Webhook System (`src/queue/webhooks.ts`)

Emits events to configured webhook endpoints.

```typescript
export interface WebhookEvent {
  type: 'message/queued' | 'message/processing' | 'message/processed' | 'message/failed';
  message: QueuedMessage;
  timestamp: number;
  error?: string;
}

export async function emitWebhookEvent(
  type: WebhookEvent['type'],
  msg: QueuedMessage,
  error?: string
): Promise<void> {
  const cfg = loadConfig();
  const webhooks = cfg.queue?.webhooks || [];

  for (const webhook of webhooks) {
    try {
      await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': webhook.secret,
        },
        body: JSON.stringify({ type, message: msg, timestamp: Date.now(), error }),
      });
    } catch (err) {
      log(`webhook failed ${webhook.url}: ${err}`);
    }
  }
}
```

#### 6. Integration Points

##### Channel Adapter Integration

**Telegram**: Modify `src/telegram/bot-handlers.ts`
```typescript
// Existing: await processMessage(ctx, allMedia, storeAllowFrom);
// New: await enqueueTelegramMessage(ctx, allMedia, storeAllowFrom);

export async function enqueueTelegramMessage(
  ctx: unknown,
  allMedia: MediaFile[],
  storeAllowFrom: string[]
): Promise<void> {
  const msg: QueuedMessage = {
    id: generateMessageId(),
    channel: 'telegram',
    sessionKey: deriveSessionKey(ctx),
    userId: extractUserId(ctx),
    text: extractText(ctx),
    media: allMedia,
    timestamp: Date.now(),
    priority: 50, // Will be updated by prioritizer
    metadata: { ctx },
    retryCount: 0,
  };

  await enqueueMessage(msg);
}
```

##### Gateway Integration

**Config Schema**: Add queue configuration to `src/config/config.ts`
```typescript
export interface QueueConfig {
  enabled: boolean;
  redis: {
    url: string;
    keyPrefix: string;
  };
  priority: {
    adminUsers: string[];
    ownerUserIds: string[];
    urgentKeywords: string[];
  };
  worker: {
    maxConcurrency: number;
    pollIntervalMs: number;
    maxRetries: number;
  };
  webhooks: Array<{
    url: string;
    secret: string;
    events: string[];
  }>;
}

export interface OpenClawConfig {
  // ... existing fields
  queue?: QueueConfig;
}
```

## Data Structures in Redis

### Message Queue
```
ZADD openclaw:queue:all {priority_score} {message_id}
HSET openclaw:message:{message_id} {json_data}
```

### Priority Buckets (optional optimization)
```
ZADD openclaw:queue:priority:0 {timestamp} {message_id}
ZADD openclaw:queue:priority:10 {timestamp} {message_id}
...
```

### Processing Status
```
XADD openclaw:stream:processing * {message_id} {status} {timestamp}
```

### Dead Letter Queue
```
ZADD openclaw:dlq {timestamp} {message_id}
HSET openclaw:dlq:{message_id} {json_data} {error}
```

### Rate Limiting (per user)
```
INCR openclaw:ratelimit:{user_id}
EXPIRE openclaw:ratelimit:{user_id} 60
```

## Deployment

### Ubuntu Setup

```bash
# Install Redis
sudo apt update
sudo apt install -y redis-server

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Clone and build
git clone https://github.com/mfathy00/openclaw.git
cd openclaw
npm install
npm run build

# Create systemd service
sudo cp scripts/openclaw-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable openclaw-worker
sudo systemctl start openclaw-worker
```

### Systemd Service

```ini
[Unit]
Description=OpenClaw Queue Worker
After=network.target redis.service
Requires=redis.service

[Service]
Type=simple
User=openclaw
WorkingDirectory=/opt/openclaw
ExecStart=/usr/bin/node /opt/openclaw/dist/queue/worker.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## Testing Strategy

### Unit Tests

- `src/queue/producer.test.ts`
- `src/queue/prioritizer.test.ts`
- `src/queue/redisQueue.test.ts`
- `src/queue/webhooks.test.ts`

### Integration Tests

- End-to-end message flow: enqueue → process → webhook
- Priority logic verification
- Redis persistence
- Dead letter queue handling

### Load Tests

```bash
# Simulate high message volume
npm run test:queue:load
```

## Monitoring & Observability

### Metrics

- Queue depth (pending messages)
- Processing time (avg, p95, p99)
- Error rate
- Retry rate
- Webhook success rate

### Health Endpoints

```typescript
GET /queue/health
{
  "status": "healthy",
  "queueDepth": 42,
  "processing": 3,
  "redisConnected": true
}
```

### Logs

- Structured logging with timestamps
- Message ID tracking across the pipeline
- Error stack traces for failed messages

## Security Considerations

1. **Redis Authentication**: Use Redis AUTH with strong password
2. **Webhook Secrets**: Validate webhook signatures
3. **Rate Limiting**: Per-user rate limits to prevent abuse
4. **Input Validation**: Sanitize all message data
5. **TLS**: Use TLS for Redis and webhook connections

## Performance Targets

- **Throughput**: 1000+ messages/second
- **Latency**: <100ms from enqueue to dispatch
- **Queue Depth**: Handle 100K+ pending messages
- **Recovery**: <30s to process backlog after restart

## Migration Strategy

### Phase 1: Feature Flag
- Queue system disabled by default
- Opt-in via configuration

### Phase 2: Gradual Rollout
- Enable for single channel (e.g., Telegram)
- Monitor metrics
- Expand to other channels

### Phase 3: Default Enable
- Enable by default after validation

## Future Enhancements

1. **Message Batching**: Process multiple messages together
2. **Distributed Workers**: Multiple worker instances
3. **Priority Scheduling**: More sophisticated scheduling algorithms
4. **Message Deduplication**: Handle duplicate messages
5. **Backpressure**: Throttle when queue is full

## Conclusion

This queue system provides a robust foundation for scaling OpenClaw's message processing across multiple channels. It ensures reliability, prioritization, and observability while maintaining compatibility with existing channel integrations.
