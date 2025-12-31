# E2E Telegram Bot Testing Guide

## Overview

This guide covers how to perform end-to-end testing of the Clawdis Telegram bot, including sending test messages and verifying responses.

## Prerequisites

1. Gateway running: `./scripts/bot-status.sh` shows all green
2. Environment loaded: `source .env`
3. Bot token configured in `.env` or `~/.clawdis/secrets.env`
4. Your Telegram ID in `allowFrom` config

## Quick E2E Test

### 1. Check Bot Health
```bash
./scripts/bot-status.sh
```

Expected output:
- All ports LISTENING
- Telegram API CONNECTED
- Service ACTIVE

### 2. Send Test Message (Outbound)

Send a message FROM the bot TO your Telegram:
```bash
source .env

curl -s -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=14835038" \
  -d "text=E2E Test: $(date +%Y-%m-%d_%H:%M:%S)"
```

**Expected:** JSON response with `"ok": true` and message details.

### 3. Test Inbound Processing

Send a message FROM Telegram TO the bot:
1. Open Telegram app
2. Send message to @Lana_smartai_bot
3. Wait for response

**Expected:** Bot responds with AI-generated reply.

### 4. Check Bot Received Message

View pending updates:
```bash
source .env
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

If `pending_update_count > 0`, messages are queued but not processed yet.

## Detailed Testing Scripts

### Test Script: Full E2E
```bash
#!/bin/bash
# e2e-test.sh

source /home/almaz/zoo_flow/clawdis/.env

echo "=== E2E Telegram Bot Test ==="
echo "Time: $(date)"
echo ""

# 1. Health Check
echo "1. Health Check..."
if ./scripts/health-check.sh > /dev/null 2>&1; then
    echo "   ✓ Gateway healthy"
else
    echo "   ✗ Gateway unhealthy"
    exit 1
fi

# 2. Bot API Check
echo "2. Bot API Check..."
BOT_INFO=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe")
if echo "$BOT_INFO" | grep -q '"ok":true'; then
    BOT_NAME=$(echo "$BOT_INFO" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
    echo "   ✓ Bot connected: @$BOT_NAME"
else
    echo "   ✗ Bot API failed"
    exit 1
fi

# 3. Send Test Message
echo "3. Sending test message..."
TEST_MSG="E2E Test $(date +%H:%M:%S)"
SEND_RESULT=$(curl -s -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=14835038" \
  -d "text=$TEST_MSG")

if echo "$SEND_RESULT" | grep -q '"ok":true'; then
    MSG_ID=$(echo "$SEND_RESULT" | grep -o '"message_id":[0-9]*' | cut -d: -f2)
    echo "   ✓ Message sent (ID: $MSG_ID)"
else
    echo "   ✗ Send failed"
    exit 1
fi

# 4. Check Webhook/Polling Status
echo "4. Checking polling status..."
WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo")
PENDING=$(echo "$WEBHOOK_INFO" | grep -o '"pending_update_count":[0-9]*' | cut -d: -f2)
echo "   Pending updates: ${PENDING:-0}"

# 5. Network Connection Check
echo "5. Network connections..."
CONN_COUNT=$(ss -tnp 2>/dev/null | grep -c "api.telegram.org\|149.154" || echo "0")
echo "   Active Telegram connections: $CONN_COUNT"

echo ""
echo "=== Test Complete ==="
```

### Test Script: Response Time
```bash
#!/bin/bash
# test-response-time.sh

source /home/almaz/zoo_flow/clawdis/.env

echo "Testing bot response time..."

# Send message with timestamp
START=$(date +%s.%N)
curl -s -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=14835038" \
  -d "text=Ping $(date +%s)" > /dev/null
END=$(date +%s.%N)

DURATION=$(echo "$END - $START" | bc)
echo "Outbound message latency: ${DURATION}s"
```

## CLI-Based Testing

### Using clawdis agent
```bash
# Send a message and get AI response
source .env
pnpm clawdis agent \
  --message "What is 2+2?" \
  --session-id test-e2e \
  --timeout 30
```

### Using clawdis send
```bash
# Send via telegram provider (one-way)
source .env
pnpm clawdis send \
  --provider telegram \
  --to 14835038 \
  --message "Test from CLI"
```

## Debugging Failed Tests

### Bot Not Responding

1. **Check process:**
   ```bash
   pgrep -f "clawdis gateway"
   ```

2. **Check connections:**
   ```bash
   ss -tnp | grep $(pgrep -f "clawdis gateway")
   ```

3. **Check logs:**
   ```bash
   tail -20 ~/.clawdis/gateway-error.log
   ```

4. **Restart service:**
   ```bash
   sudo systemctl restart clawdis-gateway
   ```

### Message Not Delivered

1. **Verify chat ID:**
   ```bash
   # Your Telegram ID should be in allowFrom
   cat ~/.clawdis/clawdis.json | grep allowFrom
   ```

2. **Check pending updates:**
   ```bash
   source .env
   curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=5"
   ```

3. **Test direct API:**
   ```bash
   source .env
   curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
   ```

## Automated Monitoring

### Cron-Based Health Check
Add to crontab:
```bash
# Check every 5 minutes, restart if unhealthy
*/5 * * * * /home/almaz/zoo_flow/clawdis/scripts/watchdog.sh
```

### Telegram Self-Test (Advanced)
Create a scheduled self-test that sends a message and verifies receipt:
```bash
#!/bin/bash
# self-test.sh - Run hourly via cron

source /home/almaz/zoo_flow/clawdis/.env
ADMIN_CHAT_ID=14835038

# Send heartbeat
curl -s -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=$ADMIN_CHAT_ID" \
  -d "text=🤖 Bot heartbeat: $(date +%H:%M)" \
  -d "disable_notification=true" > /dev/null
```

## Test Scenarios Checklist

- [ ] Bot responds to `/start` command
- [ ] Bot responds to plain text message
- [ ] Bot handles long messages (>1000 chars)
- [ ] Bot handles rapid messages (rate limiting)
- [ ] Bot recovers after restart
- [ ] Bot handles network interruptions
- [ ] Outbound messages are delivered
- [ ] Error messages are handled gracefully

## Environment Variables

Required for testing:
```bash
TELEGRAM_BOT_TOKEN=your-bot-token
ANTHROPIC_API_KEY=your-api-key
```

## Related Documentation

- [DevOps Guide](./DEVOPS_GUIDE.md) - Service management
- [Debug Session](./DEBUG_SESSION_2025-12-31.md) - Debugging example
- [Telegram Bot Production](./telegram-bot-production.md) - Deployment guide
