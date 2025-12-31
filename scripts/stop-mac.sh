#!/usr/bin/env bash
# Stop the Clawdis macOS app (gateway runs inside the menubar app).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PROCESS_PATTERN="Clawdis.app/Contents/MacOS/Clawdis"
DEBUG_PROCESS_PATTERN="${ROOT_DIR}/apps/macos/.build/debug/Clawdis"
LOCAL_PROCESS_PATTERN="${ROOT_DIR}/apps/macos/.build-local/debug/Clawdis"
RELEASE_PROCESS_PATTERN="${ROOT_DIR}/apps/macos/.build/release/Clawdis"

log()  { printf '%s\n' "$*"; }

kill_all_clawdis() {
  for _ in {1..10}; do
    pkill -f "${APP_PROCESS_PATTERN}" 2>/dev/null || true
    pkill -f "${DEBUG_PROCESS_PATTERN}" 2>/dev/null || true
    pkill -f "${LOCAL_PROCESS_PATTERN}" 2>/dev/null || true
    pkill -f "${RELEASE_PROCESS_PATTERN}" 2>/dev/null || true
    pkill -x "Clawdis" 2>/dev/null || true
    if ! pgrep -f "${APP_PROCESS_PATTERN}" >/dev/null 2>&1 \
       && ! pgrep -f "${DEBUG_PROCESS_PATTERN}" >/dev/null 2>&1 \
       && ! pgrep -f "${LOCAL_PROCESS_PATTERN}" >/dev/null 2>&1 \
       && ! pgrep -f "${RELEASE_PROCESS_PATTERN}" >/dev/null 2>&1 \
       && ! pgrep -x "Clawdis" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.3
  done
}

stop_launch_agent() {
  launchctl bootout gui/"$UID"/com.steipete.clawdis 2>/dev/null || true
}

log "==> stopping Clawdis"
stop_launch_agent
kill_all_clawdis
log "OK: Clawdis stopped."
