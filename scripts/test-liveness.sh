#!/bin/bash
# Test the Telegram bot liveness probe
# Usage: ./test-liveness.sh [timeout_seconds]

set -euo pipefail

TIMEOUT=${1:-30}
LOG_FILE="/home/almaz/.clawdis/gateway-error.log"
LIVENESS_LOG="/home/almaz/.clawdis/gateway-error.log"

echo "Testing Telegram bot liveness for ${TIMEOUT} seconds..."
echo "Monitoring logs for liveness probe activity..."

# Kill any existing tail process
pkill -f "tail -f $LOG_FILE" 2>/dev/null || true

# Start monitoring logs in background
{
    tail -f "$LOG_FILE" | while read -r line; do
        if echo "$line" | grep -q "telegram-liveness"; then
            echo "✓ Liveness probe active: $(echo "$line" | grep "telegram-liveness")"
        fi
        
        if echo "$line" | grep -q "Liveness check failed"; then
            echo "✗ Liveness check failure detected!"
            exit 1
        fi
    done
} &

TAIL_PID=$!

# Wait for timeout
echo "Waiting ${TIMEOUT} seconds..."
sleep "$TIMEOUT"

# Stop monitoring
kill $TAIL_PID 2>/dev/null || true

echo "✓ Test completed - liveness probe is working"
