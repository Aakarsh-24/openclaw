# Telegram Bot Liveness Probe

## Overview

The liveness probe is a critical reliability feature that prevents silent failures in long-polling Telegram bots. It actively verifies that the bot can communicate with the Telegram API, and forces a restart (by exiting the process) if it becomes unresponsive.

## Problem Solved

**Before this feature:**
- Network blips could silently break the long-polling connection
- The bot process would keep running but stop receiving messages
- systemd wouldn't restart it because the process hadn't crashed
- Bot would appear "online" but not respond to anything

**After this feature:**
- Liveness checks run every 60 seconds
- If 3 consecutive checks fail, the process exits
- systemd automatically restarts the service
- Bot recovers automatically within ~3 minutes of failure

## How It Works

The probe performs periodic health checks that verify:
1. The bot can reach the Telegram API (`getMe` endpoint)
2. API calls complete within timeout (default: 15 seconds)
3. Multiple failures trigger process termination

```
Liveness Check Flow:
┌─────────────┐
│  bot.start()│
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  Every 60 sec    │◄────┐
│  getMe() API call│     │
└──────┬───────────┘     │
       │ Success         │ Failure
       │                 │
       ▼                 │
┌──────────────┐         │
│Reset Failures│         │
└──────┬───────┘         │
       │                 │
       │                 ▼
       │         ┌──────────────┐
       │         │Increment     │
       │         │Failure Count │
       │         └──────┬───────┘
       │                │
       │                │ ≥3 failures?
       │                │
       │                ▼
       │         ┌──────────────┐
       │         │process.exit(1)│
       │         └──────┬───────┘
       │                │
       │                ▼
       │         ┌──────────────┐
       └────────►│systemd       │
                 │Restart=always│
                 └──────┬───────┘
                        │
                        ▼
                  ┌──────────┐
                  │ bot.start()│
                  └──────────┘
```

## Configuration

The liveness probe is **enabled by default** for long-polling mode and **disabled for webhook mode**.

You can configure it in your `clawdis.json`:

```json5
{
  "telegram": {
    "enabled": true,
    "botToken": "your-token",
    "livenessProbe": {
      "enabled": true,     // Enable/disable probe
      "intervalMs": 60000,  // Check interval (ms)
      "timeoutMs": 15000,   // Operation timeout (ms)
      "maxFailures": 3      // Failures before restart
    }
  }
}
```

Or via environment variables for the gateway service:

```bash
# In your systemd service or .env file
TELEGRAM_LIVENESS_INTERVAL=60000
TELEGRAM_LIVENESS_TIMEOUT=15000
TELEGRAM_LIVENESS_MAX_FAILURES=3
```

## Logs

Monitor liveness probe activity in the logs:

```bash
# Watch for liveness probe events
journalctl -u clawdis-gateway -f | grep telegram-liveness

# Check for failures
journalctl -u clawdis-gateway -n 100 | grep "Liveness check"
```

Example log output:
```
[telegram-liveness] Started liveness probe (interval: 60000ms, timeout: 15000ms)
[telegram-liveness] Running liveness check
[telegram-liveness] Liveness check passed
[telegram-liveness] Running liveness check
[telegram-liveness] Liveness check failed (1/3): ETIMEDOUT
[telegram-liveness] Running liveness check
[telegram-liveness] Liveness check failed (2/3): ECONNRESET
[telegram-liveness] Running liveness check
[telegram-liveness] Liveness check failed (3/3): ECONNREFUSED
[telegram-liveness] Liveness check failed: ECONNREFUSED. Exiting to force restart.
```

## Testing

Run the test script to verify liveness probe is working:

```bash
# Test for 30 seconds
./scripts/test-liveness.sh 30

# Test for 2 minutes
./scripts/test-liveness.sh 120
```

## Monitoring & Alerting

Integrate with your monitoring system:

```bash
# Check if bot has restarted recently
journalctl -u clawdis-gateway --since "1 hour ago" | grep "Started Clawdis Gateway"

# Count restarts in the last day
journalctl -u clawdis-gateway --since "1 day ago" | grep -c "Starting Clawdis Gateway"

# Alert if more than 5 restarts in 24 hours
RESTART_COUNT=$(journalctl -u clawdis-gateway --since "1 day ago" | grep -c "Started Clawdis Gateway")
if [ "$RESTART_COUNT" -gt 5 ]; then
  echo "ALERT: Bot restarted $RESTART_COUNT times in 24 hours"
  # Send notification via your alerting system
fi
```

## Troubleshooting

**If the bot restarts frequently:**
1. Check network stability: `ping api.telegram.org`
2. Increase timeout: `timeoutMs: 30000`
3. Increase failure threshold: `maxFailures: 5`
4. Check for rate limiting: Look for 429 errors in logs

**If the bot doesn't restart when stuck:**
1. Verify liveness probe is enabled: Check logs for "Started liveness probe"
2. Enable debug logging: `LOG_LEVEL=debug`
3. Check probe is running: `ps aux | grep clawdis`

## Best Practices

1. **Keep defaults** for most deployments (60s interval, 3 failures)
2. **Monitor restart frequency** - frequent restarts indicate network/API issues
3. **Set up alerts** for multiple restarts in a short period
4. **Use webhook mode** if you need instant recovery (but requires public URL)
5. **Combine with systemd** for automatic recovery

## Comparison: With vs Without Liveness Probe

| Scenario | Without Probe | With Probe |
|----------|---------------|------------|
| Network blip (30s) | Bot stuck, manual restart needed | Automatic recovery in ~3 min |
| Telegram API down (5 min) | Bot frozen, no recovery | Process exits, systemd restarts when API is back |
| Rate limit 429 | Silent failure | Process exits after 3 failures |
| Process crash | systemd restarts | systemd restarts (same) |
| Normal operation | Works fine | Works fine + health monitoring |

## Technical Details

The probe uses grammY's built-in `getMe` API call with AbortController for timeout handling. It's designed to be lightweight and not interfere with normal bot operations.

**Process lifecycle with liveness probe:**
1. Process starts → systemd
2. Bot initializes → liveness probe starts
3. Normal operation → periodic checks every 60s
4. Failure detected → consecutive failure counter increases
5. Max failures reached → process.exit(1)
6. systemd detects exit → restarts service
7. Back to step 1

**Resource impact:**
- ~1 API call per minute (negligible)
- No impact on message handling
- Minimal memory overhead
