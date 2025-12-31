#!/bin/bash
# Clawdis Bot Status Dashboard
# Usage: ./bot-status.sh

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║         CLAWDIS TELEGRAM BOT STATUS DASHBOARD            ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_section() {
    echo -e "${YELLOW}▶ $1${NC}"
}

status_icon() {
    if [ "$1" = "ok" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
}

print_header

# System Info
print_section "SYSTEM INFO"
echo "  Hostname: $(hostname)"
echo "  Time:     $(date)"
echo "  Uptime:   $(uptime -p)"
echo ""

# Process Status
print_section "PROCESS STATUS"
if pgrep -f "clawdis gateway" > /dev/null; then
    pid=$(pgrep -f "clawdis gateway" | head -1)
    mem=$(ps -o rss= -p "$pid" 2>/dev/null | awk '{printf "%.1f", $1/1024}')
    cpu=$(ps -o %cpu= -p "$pid" 2>/dev/null | tr -d ' ')
    start_time=$(ps -o lstart= -p "$pid" 2>/dev/null)
    echo -e "  Status:   $(status_icon ok) RUNNING (PID: $pid)"
    echo "  Memory:   ${mem}MB"
    echo "  CPU:      ${cpu}%"
    echo "  Started:  $start_time"
else
    echo -e "  Status:   $(status_icon fail) NOT RUNNING"
fi
echo ""

# Port Status
print_section "PORT STATUS"
check_port() {
    if ss -tuln | grep -q ":$1 "; then
        echo -e "  $2 (port $1): $(status_icon ok) LISTENING"
    else
        echo -e "  $2 (port $1): $(status_icon fail) NOT LISTENING"
    fi
}
check_port 18789 "Gateway"
check_port 18790 "Bridge"
check_port 18791 "Browser"
check_port 18793 "Canvas"
echo ""

# Telegram API
print_section "TELEGRAM API"
TOKEN=$(grep TELEGRAM_BOT_TOKEN /home/almaz/zoo_flow/clawdis/.env 2>/dev/null | cut -d= -f2 || echo "")
if [ -n "$TOKEN" ]; then
    response=$(curl -s --max-time 5 "https://api.telegram.org/bot${TOKEN}/getMe" 2>/dev/null || echo "error")
    if echo "$response" | grep -q '"ok":true'; then
        bot_name=$(echo "$response" | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
        echo -e "  Bot API:  $(status_icon ok) CONNECTED (@$bot_name)"
    else
        echo -e "  Bot API:  $(status_icon fail) FAILED"
    fi
else
    echo "  Bot API:  (token not found)"
fi
echo ""

# Z.ai API
print_section "Z.AI API"
API_KEY=$(grep ANTHROPIC_API_KEY /home/almaz/zoo_flow/clawdis/.env 2>/dev/null | cut -d= -f2 || echo "")
if [ -n "$API_KEY" ]; then
    response=$(curl -s --max-time 5 -H "x-api-key: $API_KEY" "https://api.z.ai/api/anthropic/v1/models" 2>/dev/null || echo "error")
    if echo "$response" | grep -q '"data"'; then
        echo -e "  API:      $(status_icon ok) CONNECTED"
    else
        echo -e "  API:      $(status_icon fail) FAILED"
    fi
else
    echo "  API:      (key not found)"
fi
echo ""

# Logs
print_section "LOG FILES"
for logfile in /home/almaz/.clawdis/*.log; do
    [ -f "$logfile" ] || continue
    name=$(basename "$logfile")
    size=$(du -h "$logfile" 2>/dev/null | cut -f1)
    lines=$(wc -l < "$logfile" 2>/dev/null || echo 0)
    echo "  $name: $size ($lines lines)"
done
echo ""

# Recent Errors
print_section "RECENT ERRORS (last 5)"
tail -5 /home/almaz/.clawdis/gateway-error.log 2>/dev/null | while read line; do
    echo "  $line"
done || echo "  (no errors)"
echo ""

# Systemd Service
print_section "SYSTEMD SERVICE"
if systemctl is-active --quiet clawdis-gateway 2>/dev/null; then
    echo -e "  Service:  $(status_icon ok) ACTIVE"
else
    echo -e "  Service:  $(status_icon fail) INACTIVE"
fi
if systemctl is-enabled --quiet clawdis-gateway 2>/dev/null; then
    echo -e "  Enabled:  $(status_icon ok) YES"
else
    echo -e "  Enabled:  $(status_icon fail) NO"
fi
echo ""

# Quick Commands
echo -e "${BLUE}══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}QUICK COMMANDS:${NC}"
echo "  Restart:  sudo systemctl restart clawdis-gateway"
echo "  Logs:     sudo journalctl -u clawdis-gateway -f"
echo "  Health:   ./scripts/health-check.sh --verbose"
echo ""
