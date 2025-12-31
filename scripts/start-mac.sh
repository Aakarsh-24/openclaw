#!/usr/bin/env bash
# Launch the Clawdis macOS app (gateway runs inside the menubar app).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_BUNDLE="${CLAWDIS_APP_BUNDLE:-}"
APP_PROCESS_PATTERN="Clawdis.app/Contents/MacOS/Clawdis"

log()  { printf '%s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

choose_app_bundle() {
  if [[ -n "${APP_BUNDLE}" && -d "${APP_BUNDLE}" ]]; then
    return 0
  fi

  if [[ -d "/Applications/Clawdis.app" ]]; then
    APP_BUNDLE="/Applications/Clawdis.app"
    return 0
  fi

  if [[ -d "${ROOT_DIR}/dist/Clawdis.app" ]]; then
    APP_BUNDLE="${ROOT_DIR}/dist/Clawdis.app"
    return 0
  fi

  fail "App bundle not found. Set CLAWDIS_APP_BUNDLE to your installed Clawdis.app"
}

if pgrep -f "${APP_PROCESS_PATTERN}" >/dev/null 2>&1 || pgrep -x "Clawdis" >/dev/null 2>&1; then
  log "OK: Clawdis already running."
  exit 0
fi

choose_app_bundle

log "==> launching ${APP_BUNDLE}"
env -i \
  HOME="${HOME}" \
  USER="${USER:-$(id -un)}" \
  LOGNAME="${LOGNAME:-$(id -un)}" \
  TMPDIR="${TMPDIR:-/tmp}" \
  PATH="/usr/bin:/bin:/usr/sbin:/sbin" \
  LANG="${LANG:-en_US.UTF-8}" \
  /usr/bin/open "${APP_BUNDLE}"

sleep 1.5
if pgrep -f "${APP_PROCESS_PATTERN}" >/dev/null 2>&1 || pgrep -x "Clawdis" >/dev/null 2>&1; then
  log "OK: Clawdis is running."
else
  fail "App exited immediately. Check /tmp/clawdis.log or Console.app (User Reports)."
fi
