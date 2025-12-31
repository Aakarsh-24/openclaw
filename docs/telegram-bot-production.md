---
summary: "Production deployment guide for Telegram bot with systemd service management"
read_when:
  - Deploying Telegram bot to production
  - Setting up auto-restart and monitoring
  - Troubleshooting connectivity issues
---

# Telegram Bot Production Deployment

## Overview
This guide covers deploying the Clawdis Telegram bot as a production-grade systemd service with automatic restart, logging, and monitoring capabilities.

## Prerequisites
- Node.js v22.x+ installed via fnm
- pnpm package manager (installed via corepack)
- Telegram bot token from @BotFather
- Working directory: `/home/almaz/zoo_flow/clawdis`

## Quick Start

### 1. Verify Installation
```bash
# Check Node.js version
node --version  # Should be v22.x

# Verify pnpm is available
which pnpm
# Expected: /home/almaz/.local/share/fnm/node-versions/v22.21.1/installation/bin/pnpm

# Test bot startup (manual)
cd /home/almaz/zoo_flow/clawdis
pnpm clawdis gateway --port 18789 --allow-unconfigured
```

### 2. Deploy Systemd Service

The systemd service file is located at `/etc/systemd/system/clawdis-gateway.service`

**Service file contents:**
```ini
[Unit]
Description=Clawdis Gateway (Telegram Bot)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/home/almaz/zoo_flow/clawdis/scripts/start-gateway.sh
Restart=always
RestartSec=5
User=almaz
Environment=TELEGRAM_BOT_TOKEN=<your-token>
Environment=ANTHROPIC_API_KEY=<your-key>
Environment=ZAI_API_KEY=<your-key>
Environment=ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
Environment=NODE_ENV=production
Environment=HOME=/home/almaz
WorkingDirectory=/home/almaz/zoo_flow/clawdis
KillMode=mixed
TimeoutStopSec=30
StandardOutput=append:/home/almaz/.clawdis/gateway.log
StandardError=append:/home/almaz/.clawdis/gateway-error.log

[Install]
WantedBy=multi-user.target
```

**Wrapper script** (`/home/almaz/zoo_flow/clawdis/scripts/start-gateway.sh`):
```bash
#!/bin/bash
# Wrapper script to start Clawdis Gateway with correct environment

# Use full path to pnpm
PNPM_PATH="/home/almaz/.local/share/fnm/node-versions/v22.21.1/installation/bin/pnpm"

# Ensure we're in the right directory
cd /home/almaz/zoo_flow/clawdis

# Verify pnpm exists
if [ ! -f "$PNPM_PATH" ]; then
    echo "ERROR: pnpm not found at $PNPM_PATH"
    exit 1
fi

# Start the gateway with full path to pnpm
exec "$PNPM_PATH" clawdis gateway --port 18789 --allow-unconfigured
```

### 3. Service Management Commands

```bash
# Deploy or update service
sudo cp /home/almaz/zoo_flow/clawdis/clawdis-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable clawdis-gateway

# Start service
sudo systemctl start clawdis-gateway

# Stop service
sudo systemctl stop clawdis-gateway

# Restart service
sudo systemctl restart clawdis-gateway

# Check status
sudo systemctl status clawdis-gateway

# View logs in real-time
sudo journalctl -u clawdis-gateway -f

# View recent logs
sudo journalctl -u clawdis-gateway -n 50 --no-pager

# Check if service is listening on ports
sudo ss -tulpn | grep -E ":18789|:18790|:18791|:18793"
```

## Configuration

### Environment Variables
Set these in the systemd service file:
- `TELEGRAM_BOT_TOKEN`: Bot token from @BotFather
- `ANTHROPIC_API_KEY`: API key for AI provider
- `ZAI_API_KEY`: Alternative API key
- `ANTHROPIC_BASE_URL`: API endpoint URL
- `NODE_ENV`: Set to `production`

### Telegram Configuration
Edit `/home/almaz/.clawdis/clawdis.json`:
```json
{
  "telegram": {
    "allowFrom": ["14835038"],
    "botToken": "YOUR_BOT_TOKEN",
    "proxy": "http://user205740:8f39bh@103.99.54.122:8019"
  }
}
```

**CRITICAL: Proxy is REQUIRED** - This server cannot reach Telegram directly (TCP blocked). Without proxy, connections will hang in SYN-SENT state.

### Token Must Be Set In 3 Places
When updating the bot token, update ALL of these:
1. `~/.clawdis/clawdis.json` → `telegram.botToken`
2. `/home/almaz/zoo_flow/clawdis/.env` → `TELEGRAM_BOT_TOKEN=`
3. `~/.clawdis/secrets.env` → `TELEGRAM_BOT_TOKEN=`

Then restart: `sudo systemctl restart clawdis-gateway`

## Troubleshooting

### Common Issues

#### 1. Exit Code 127 (Command Not Found)
**Symptoms:** Service fails immediately with status 127
**Cause:** pnpm not found in PATH
**Solution:** Verify pnpm path and update wrapper script
```bash
which pnpm
# Update PNPM_PATH in start-gateway.sh with the full path
```

#### 2. Exit Code 1 (Startup Failure)
**Symptoms:** Service starts then stops with status 1
**Cause:** Bot not configured or missing --allow-unconfigured flag
**Solution:** Ensure wrapper script includes `--allow-unconfigured` flag

#### 3. Connection Refused
**Symptoms:** Cannot connect to gateway on port 18789
**Cause:** Service not running or port not listening
**Solution:** Check service status and port binding
```bash
sudo systemctl status clawdis-gateway
sudo ss -tulpn | grep 18789
```

#### 4. Telegram Bot Not Responding
**Symptoms:** Bot appears offline or doesn't reply to messages
**Cause:** Network blocked, proxy not configured, token invalid, or allowFrom misconfigured

**Solution - Check in this order:**
```bash
# 1. Check network connectivity (MOST COMMON ISSUE)
ss -tnp | grep "103.99.54.122"  # Should show ESTABLISHED
ss -tnp | grep "149.154"        # Should be EMPTY (blocked without proxy)

# 2. If SYN-SENT to 149.154.x.x - proxy not working
grep proxy ~/.clawdis/clawdis.json
# If missing, add: "proxy": "http://user205740:8f39bh@103.99.54.122:8019"

# 3. Check pending updates (should be 0)
source .env && curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
# If pending_update_count > 0, bot is not processing

# 4. Verify bot token
source .env && curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
# If 404 → token revoked, get new from @BotFather

# 5. Restart after any fix
sudo systemctl restart clawdis-gateway
```

#### 5. Network Connections Stuck in SYN-SENT
**Symptoms:** `ss -tnp` shows SYN-SENT to 149.154.167.220 (Telegram IP)
**Cause:** Direct TCP to Telegram blocked by firewall/ISP
**Solution:** Configure proxy in `~/.clawdis/clawdis.json`:
```json
{
  "telegram": {
    "proxy": "http://user205740:8f39bh@103.99.54.122:8019"
  }
}
```
Then: `sudo systemctl restart clawdis-gateway`

#### 5. Markdown Formatting Errors
**Symptoms:** "Can't parse entities" errors in logs
**Cause:** Bot sending malformed markdown
**Solution:** Disable markdown or fix formatting in bot responses

### Log Files
- **Gateway logs:** `/home/almaz/.clawdis/gateway.log`
- **Error logs:** `/home/almaz/.clawdis/gateway-error.log`
- **Systemd logs:** `sudo journalctl -u clawdis-gateway`
- **Telegram logs:** Check for `subsystem:"gateway/providers/telegram"` in logs

### Testing Connectivity

```bash
# Test Telegram bot directly
pnpm clawdis send --provider telegram --to <your-telegram-id> --message "Test message"

# Test gateway health
pnpm clawdis gateway health

# Test API connectivity
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "glm-4.7", "messages": [{"role": "user", "content": "test"}]}' \
  https://api.z.ai/api/anthropic/v1/messages
```

## Monitoring

### Service Health Check
```bash
#!/bin/bash
# health-check.sh

if systemctl is-active --quiet clawdis-gateway; then
    echo "✓ Service is running"
else
    echo "✗ Service is down"
    sudo systemctl restart clawdis-gateway
fi

if ss -tuln | grep -q ":18789"; then
    echo "✓ Port 18789 is listening"
else
    echo "✗ Port 18789 not listening"
fi
```

### Metrics to Monitor
- Service uptime: `systemctl status clawdis-gateway`
- Restart count: `sudo journalctl -u clawdis-gateway | grep "restart counter"`
- Memory usage: `ps aux | grep clawdis | grep -v grep`
- Response time: Monitor Telegram message delivery latency

## Alternative: PM2 Deployment

If systemd is not preferred, use PM2:

```bash
# Install PM2
npm install -g pm2

# Start with ecosystem config
pm2 start ecosystem.config.cjs --env production

# Save configuration
pm2 save

# Setup startup script
pm2 startup

# Monitor
pm2 monit
pm2 logs clawdis-gateway
```

## Security Best Practices

1. **Keep API keys secure**
   - Never commit keys to git
   - Use environment variables in systemd service
   - Restrict file permissions: `chmod 600 ~/.clawdis/clawdis.json`

2. **Use allowFrom for Telegram**
   - Restrict bot to specific user IDs
   - Don't use wildcard `"*"` in production

3. **Monitor for unauthorized access**
   - Check logs regularly for suspicious activity
   - Set up alerts for service failures

4. **Update dependencies**
   ```bash
   pnpm update --latest
   sudo systemctl restart clawdis-gateway
   ```

## Rollback Procedure

If deployment fails:

1. Stop the service:
   ```bash
   sudo systemctl stop clawdis-gateway
   ```

2. Check manual startup:
   ```bash
   cd /home/almaz/zoo_flow/clawdis
   pnpm clawdis gateway --port 18789 --allow-unconfigured
   ```

3. Review logs and fix issues

4. Restart service:
   ```bash
   sudo systemctl start clawdis-gateway
   ```

## Support

For additional help:
- Check logs: `sudo journalctl -u clawdis-gateway -n 100`
- Review Telegram provider docs: `docs/telegram.md`
- Review gateway docs: `docs/gateway.md`
- Test connectivity step by step using this guide
