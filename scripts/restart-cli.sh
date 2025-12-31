#!/usr/bin/env bash
# Simple CLI gateway restart (no macOS app build required).

set -euo pipefail

# Ensure fnm and pnpm are available
eval "$(fnm env --shell bash)" 2>/dev/null || true

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATEWAY_PID_FILE="/tmp/clawdis-gateway.pid"

log()  { printf '%s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

cd "${ROOT_DIR}"

# Kill existing CLI gateway processes
pkill -f "clawdis gateway" 2>/dev/null || true
sleep 0.5

# Bundle canvas assets
log "==> bundle canvas a2ui"
pnpm canvas:a2ui:bundle >/dev/null 2>&1 || log "  (canvas bundle skipped or up to date)"

# Start gateway in background with logging
log "==> starting CLI gateway on port 18789"
fnm exec 22 -- pnpm clawdis gateway --port 18789 --allow-unconfigured >/tmp/clawdis-gateway.log 2>&1 &
GATEWAY_PID=$!
echo "${GATEWAY_PID}" > "${GATEWAY_PID_FILE}"

# Wait and verify health
sleep 2
if pnpm clawdis gateway health >/dev/null 2>&1; then
  log "OK: CLI gateway is running (PID ${GATEWAY_PID})"
  log "    Log: /tmp/clawdis-gateway.log"
else
  fail "Gateway health check failed. Check /tmp/clawdis-gateway.log"
fi
