# 🚀 Telegram Bot Quick Resume Guide

> **Last Updated:** 2025-12-30
>
> **Status:** Service deployed with systemd
> **Bot:** @Lana_smartai_bot
> **User ID:** 14835038 (in allowlist)

## 🚨 Emergency Restart (If Bot is Down)

If the bot stops responding, run this single command:

```bash
/home/almaz/zoo_flow/clawdis/scripts/resume-telegram-bot.sh
```

Or manually:
```bash
sudo systemctl restart clawdis-gateway
```

## 📊 Current Status Check

```bash
# Quick status check
sudo systemctl status clawdis-gateway --no-pager

# Check if ports are listening
sudo ss -tulpn | grep -E ":18789|:18790|:18791|:18793"

# View recent logs
sudo journalctl -u clawdis-gateway -n 30 --no-pager
```

## 🔧 Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| **Systemd Service** | `/etc/systemd/system/clawdis-gateway.service` | Service definition |
| **Startup Script** | `/home/almaz/zoo_flow/clawdis/scripts/start-gateway.sh` | Wrapper with pnpm path |
| **Bot Config** | `/home/almaz/.clawdis/clawdis.json` | Telegram settings |
| **Logs** | `/home/almaz/.clawdis/gateway.log` | Application logs |
| **Error Logs** | `/home/almaz/.clawdis/gateway-error.log` | Error logs |
| **Systemd Logs** | `sudo journalctl -u clawdis-gateway` | Service logs |

## 🛠️ Service Management

```bash
# Start service
sudo systemctl start clawdis-gateway

# Stop service
sudo systemctl stop clawdis-gateway

# Restart service (use after config changes)
sudo systemctl daemon-reload
sudo systemctl restart clawdis-gateway

# Enable auto-start on boot
sudo systemctl enable clawdis-gateway

# Disable auto-start
sudo systemctl disable clawdis-gateway

# Follow real-time logs
sudo journalctl -u clawdis-gateway -f
```

## 📝 Current Configuration

**Bot Token:** `TELEGRAM_BOT_TOKEN=6236860010:AAFOS-Mr3F7TR_rMzpLuJrzZYx6s-x5WOA0`

**API Configuration:**
```bash
ANTHROPIC_API_KEY=469c4a87d685405e982debcbcd814eac.O6fldQP7ES3zKxYE
ZAI_API_KEY=469c4a87d685405e982debcbcd814eac.O6fldQP7ES3zKxYE
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
```

**Allowlist (Telegram IDs):**
```json
["14835038"]
```

## 🧪 Testing the Bot

### Send a test message:
```bash
cd /home/almaz/zoo_flow/clawdis
pnpm clawdis send --provider telegram --to 14835038 --message "Test message"
```

### Check bot info:
```bash
curl "https://api.telegram.org/bot6236860010:AAFOS-Mr3F7TR_rMzpLuJrzZYx6s-x5WOA0/getMe"
```

### View bot logs:
```bash
# Recent bot activity
sudo journalctl -u clawdis-gateway -n 50 --no-pager | grep telegram

# Follow live logs
sudo journalctl -u clawdis-gateway -f | grep telegram
```

## 🔍 Troubleshooting

### Bot not responding?
1. **Check service status:**
   ```bash
   sudo systemctl status clawdis-gateway
   ```

2. **Check logs for errors:**
   ```bash
   sudo journalctl -u clawdis-gateway -n 30 --no-pager
   ```

3. **Common issues:**
   - **Exit code 127:** pnpm not found → Run `which pnpm` and update wrapper script
   - **Exit code 1:** API key invalid → Verify API keys in service file
   - **No response:** Check `allowFrom` config includes your Telegram ID

### API Key Issues?
Test the API directly:
```bash
curl -H "x-api-key: 469c4a87d685405e982debcbcd814eac.O6fldQP7ES3zKxYE" \
  https://api.z.ai/api/anthropic/v1/models
```

### Bot Token Issues?
Verify bot token:
```bash
curl "https://api.telegram.org/bot6236860010:AAFOS-Mr3F7TR_rMzpLuJrzZYx6s-x5WOA0/getMe"
```

## 📚 Documentation

- **Full deployment guide:** `docs/telegram-bot-production.md`
- **Telegram provider docs:** `docs/telegram.md`
- **Gateway docs:** `docs/gateway.md`
- **API Reference:** See code comments in `src/telegram/`

## 🔄 Updating the Bot

### To update code:
```bash
cd /home/almaz/zoo_flow/clawdis
git pull origin main
pnpm install
sudo systemctl restart clawdis-gateway
```

### To update configuration:
```bash
# Edit config
nano /home/almaz/.clawdis/clawdis.json

# Restart service
sudo systemctl restart clawdis-gateway
```

## 🎯 Quick Reference Card

```bash
┌─────────────────────────────────────────────────────────┐
│  Telegram Bot Management - Quick Commands              │
├─────────────────────────────────────────────────────────┤
│  Status:     sudo systemctl status clawdis-gateway     │
│  Start:      sudo systemctl start clawdis-gateway      │
│  Stop:       sudo systemctl stop clawdis-gateway       │
│  Restart:    sudo systemctl restart clawdis-gateway    │
│  Logs:       sudo journalctl -u clawdis-gateway -f     │
│  Test:       /home/almaz/zoo_flow/clawdis/scripts/     │
│              resume-telegram-bot.sh                    │
└─────────────────────────────────────────────────────────┘
```

## 📞 Support

If issues persist:
1. Check all logs: `sudo journalctl -u clawdis-gateway -n 100`
2. Run test script: `./scripts/resume-telegram-bot.sh`
3. Review full docs: `docs/telegram-bot-production.md`
4. Verify API keys are valid and not expired

## ✅ Pre-Flight Checklist

Before considering the bot "ready":
- [ ] Service is active: `sudo systemctl is-active clawdis-gateway`
- [ ] Port 18789 is listening: `sudo ss -tuln | grep 18789`
- [ ] Bot responds to Telegram messages
- [ ] Logs show no errors: `sudo journalctl -u clawdis-gateway -n 20`
- [ ] API keys are valid (test with curl commands above)
- [ ] Your Telegram ID is in allowlist
