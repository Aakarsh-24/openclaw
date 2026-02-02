# OpenClaw Message Queue System

A robust, production-ready message queue architecture for OpenClaw that enhances how messages are received, processed, prioritized, and delivered across multiple channels.

## Features

- ✅ **Multi-channel support** - Telegram, WhatsApp, Slack, Discord, Google Chat, Signal, iMessage, Microsoft Teams, WebChat, Matrix, Zalo
- ⚡ **Priority processing** - Admin > Owner > Urgent keywords > Media > Normal messages
- 💾 **Redis persistence** - Durable storage with automatic expiration
- 🔄 **Async processing** - Decoupled message ingestion from agent processing
- 🔔 **Webhook events** - Real-time notifications for queued, processing, processed, failed, and retried messages
- 🛡️ **Dead Letter Queue** - Failed messages with retry tracking
- 📊 **Monitoring** - CLI commands for status, health, and DLQ management

## Architecture

```
┌─────────────┐
│   Channel   │  (Telegram, WhatsApp, Slack, etc.)
└──────┬──────┘
       │
       ↓
┌───────────────────────────┐
│  Queue Producer        │  ← Receives & enqueues messages
└───────┬───────────────┘
        │
        ↓
┌────────────────────┐
│      Redis       │  ← Priority sorted set + streams
└───────┬────────┘
        │
        ↓
┌───────────────────────────┐
│  Queue Worker          │  ← Dequeues & processes
└───────┬───────────────┘
        │
        ↓
┌────────────────────┐
│     Agent       │  ← Existing OpenClaw AI runtime
└───────┬────────┘
        │
        ↓
┌───────────────────────────┐
│    Response     │  ← Delivered back to channel
└───────────────────────────┘

       ↕  Webhook Events (optional)
```

## Quick Start

### 1. Install Redis

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y redis-server

# macOS
brew install redis

# Start Redis
sudo systemctl start redis-server  # Linux
brew services start redis          # macOS
```

### 2. Configure OpenClaw

Create or update `config.json`:

```json
{
  "messageQueue": {
    "enabled": true,
    "redis": {
      "url": "redis://localhost:6379",
      "keyPrefix": "openclaw:queue",
      "password": "optional-password"
    },
    "priority": {
      "adminUsers": ["user-id-1", "user-id-2"],
      "ownerUserIds": ["owner-id"],
      "urgentKeywords": ["urgent", "asap", "emergency", "critical", "help!"]
    },
    "worker": {
      "maxConcurrency": 5,
      "pollIntervalMs": 100,
      "maxRetries": 3,
      "retryDelayMs": 5000
    },
    "webhooks": [
      {
        "url": "https://your-webhook.example.com/events",
        "secret": "your-webhook-secret",
        "events": ["message/queued", "message/processed", "message/failed"]
      }
    ]
  }
}
```

### 3. Start Queue Worker

```bash
# Start as standalone process
openclaw queue worker

# Or with custom concurrency
openclaw queue worker -c 10 -i 50
```

### 4. Enable in Channels

Queue integration is controlled by the `messageQueue.enabled` configuration. When enabled, channels automatically enqueue messages instead of processing them inline.

## Priority System

Messages are prioritized as follows (lower score = higher priority):

| Priority | Score | Description |
|----------|--------|-------------|
| Admin    | 0      | Users in `adminUsers` list |
| Owner    | 10     | Users in `ownerUserIds` list |
| Urgent   | 20     | Contains urgent keywords |
| High     | 30     | Contains "important", "priority", "please" |
| Media    | 40     | Has media attachments |
| Default  | 50     | All other messages |

### Urgent Keywords (default)

`urgent`, `asap`, `emergency`, `critical`, `help!`

Extend or modify via configuration.

## CLI Commands

### Status

```bash
openclaw queue status
```

Shows:
- Queue system status (enabled/disabled)
- Redis connection status
- Queue depth (pending messages)
- Dead letter queue count
- Priority rules
- Webhook configuration

### Health Check

```bash
openclaw queue health
```

Checks:
- Redis connection
- Configuration validity
- Returns healthy/unhealthy status

### Worker Management

```bash
# Start standalone worker
openclaw queue worker

# Custom concurrency
openclaw queue worker -c 10

# Custom poll interval
openclaw queue worker -i 50
```

### Dead Letter Queue

```bash
# List failed messages
openclaw queue dlq

# List with more entries
openclaw queue dlq -l 50

# Retry a failed message
openclaw queue retry <message-id>
```

### Clear Queue

```bash
# ⚠️ DANGER: Deletes all pending messages
openclaw queue clear --force
```

### Webhook Testing

```bash
# Test webhook connectivity
openclaw queue test-webhook <url> <secret>
```

## Webhook Events

The queue system emits webhook events for:

### `message/queued`
Triggered when a message is added to the queue.

```json
{
  "type": "message/queued",
  "message": {
    "id": "telegram_xxx_yyy",
    "channel": "telegram",
    "userId": "user-123",
    "text": "Hello",
    "timestamp": 1234567890,
    "priority": 50
  },
  "timestamp": 1234567890
}
```

### `message/processing`
Triggered when a message starts being processed by the agent.

### `message/processed`
Triggered when a message is successfully processed.

### `message/failed`
Triggered when a message fails after max retries.

```json
{
  "type": "message/failed",
  "message": { ... },
  "timestamp": 1234567890,
  "error": "Agent timeout after 60000ms"
}
```

### `message/retried`
Triggered when a message is being retried.

## Deployment

### Ubuntu Systemd Service

Run the setup script:

```bash
# Clone OpenClaw
git clone https://github.com/mfathy00/openclaw.git
cd openclaw

# Run setup script
sudo bash scripts/setup-queue-ubuntu.sh
```

This will:
1. Install Node.js 22.x, Redis, Git
2. Create `openclaw` user
3. Setup directories and permissions
4. Install dependencies and build
5. Configure Redis with password
6. Create and enable systemd service
7. Start the queue worker

Manual service installation:

```bash
# Copy service file
sudo cp scripts/openclaw-worker.service /etc/systemd/system/

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable openclaw-worker
sudo systemctl start openclaw-worker
```

### Monitoring Service

```bash
# Check status
sudo systemctl status openclaw-worker

# View logs
sudo journalctl -u openclaw-worker -f

# Restart
sudo systemctl restart openclaw-worker

# Stop
sudo systemctl stop openclaw-worker
```

## Configuration Reference

### `messageQueue.enabled`
- Type: `boolean`
- Default: `false`
- Description: Enable/disable the queue system

### `messageQueue.redis.url`
- Type: `string`
- Required: `true`
- Example: `redis://localhost:6379` or `redis://:password@localhost:6379`
- Description: Redis connection URL

### `messageQueue.redis.keyPrefix`
- Type: `string`
- Default: `openclaw:queue`
- Description: Prefix for Redis keys (useful for multiple environments)

### `messageQueue.priority.adminUsers`
- Type: `string[]`
- Default: `[]`
- Description: List of user IDs that get highest priority

### `messageQueue.priority.urgentKeywords`
- Type: `string[]`
- Default: `["urgent", "asap", "emergency", "critical", "help!"]`
- Description: Keywords that trigger urgent priority

### `messageQueue.worker.maxConcurrency`
- Type: `number`
- Default: `5`
- Description: Maximum parallel messages to process

### `messageQueue.worker.maxRetries`
- Type: `number`
- Default: `3`
- Description: Maximum retry attempts before sending to DLQ

### `messageQueue.webhooks`
- Type: `Array<{url, secret, events}>`
- Default: `[]`
- Description: Webhook endpoints for event notifications

## Data Storage

### Redis Keys

| Key Pattern | Type | Description |
|-------------|--------|-------------|
| `openclaw:queue:all` | Sorted Set | Priority queue |
| `openclaw:queue:message:{id}` | Hash | Message data |
| `openclaw:queue:processing` | Stream | Processing events |
| `openclaw:queue:dlq` | Sorted Set | Dead letter queue |
| `openclaw:queue:dlq:{id}` | Hash | DLQ entry data |

### Expiration

- Pending messages: 7 days
- DLQ entries: 30 days
- Processing stream: Configurable

## Troubleshooting

### Queue not processing messages

1. Check if queue is enabled: `openclaw queue status`
2. Check Redis connection: `openclaw queue health`
3. Verify worker is running: `sudo systemctl status openclaw-worker`
4. Check worker logs: `sudo journalctl -u openclaw-worker -n 50`

### High queue depth

1. Check worker logs for errors
2. Increase `worker.maxConcurrency` in config
3. Consider running multiple worker instances

### Webhooks not firing

1. Test webhook URL: `openclaw queue test-webhook <url> <secret>`
2. Check webhook server logs
3. Verify `events` array includes the event type
4. Check firewall/network connectivity

### Redis connection issues

1. Verify Redis is running: `sudo systemctl status redis-server`
2. Test Redis connection: `redis-cli ping`
3. Check Redis URL in config
4. Check Redis password (if configured)

## Testing

Run test suite:

```bash
# All queue tests
npm run test -- queue

# Specific test file
npm run test queue/producer
npm run test queue/prioritizer

# With coverage
npm run test -- --coverage
```

## API

### Queue Producer

```typescript
import {
  initProducer,
  enqueueMessage,
  getQueueDepth,
} from 'openclaw/queue';

// Initialize
await initProducer(config);

// Enqueue message
const messageId = await enqueueMessage(
  'telegram',
  'session-key',
  'user-id',
  'Hello world',
  undefined,
  { customMetadata: 'value' }
);

// Get queue depth
const depth = await getQueueDepth();
```

### Priority Rules

```typescript
import {
  determinePriority,
  isAdminUser,
  isOwnerUser,
} from 'openclaw/queue';

const priority = determinePriority(message, config);
const isAdmin = isAdminUser(userId, config);
```

## Performance

### Targets

- **Throughput**: 1000+ messages/second
- **Latency**: <100ms from enqueue to dispatch
- **Queue Depth**: Handle 100K+ pending messages
- **Recovery**: <30s to process backlog after restart

### Optimization Tips

1. **Batch messages** - Enable batching in worker config
2. **Increase concurrency** - Based on available CPU/memory
3. **Use Redis Cluster** - For distributed deployments
4. **Monitor DLQ** - Investigate frequent failures
5. **Tune poll interval** - Balance between CPU usage and responsiveness

## License

MIT - See LICENSE file for details.

## Contributing

Contributions welcome! See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## Support

- Documentation: [docs.openclaw.ai](https://docs.openclaw.ai)
- GitHub: [mfathy00/openclaw](https://github.com/mfathy00/openclaw)
- Discord: [OpenClaw Discord](https://discord.gg/clawd)
