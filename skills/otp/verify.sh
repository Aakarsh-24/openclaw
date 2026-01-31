#!/bin/bash
# Verify an OTP code and update verification state
#
# Usage: verify.sh <code> [userId]
#
# Exit codes:
#   0 - Valid code, user verified
#   1 - Invalid code
#   2 - Config/setup error

set -e

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${WORKSPACE:-$(pwd)}"
TOTP_CLI="$SKILL_DIR/../../packages/totp-cli/totp.mjs"
STATE_FILE="$WORKSPACE/memory/otp-state.json"
CONFIG_FILE="${OPENCLAW_CONFIG:-}"

# Try multiple config locations - check that secret exists too
if [ -z "$CONFIG_FILE" ] || [ ! -f "$CONFIG_FILE" ]; then
  for candidate in "$HOME/.openclaw/openclaw.json" "$HOME/.moltbot/openclaw.json" "$HOME/.moltbot/moltbot.json"; do
    if [ -f "$candidate" ]; then
      SECRET_CHECK=$(jq -r '.auth.otpVerification.secret // empty' "$candidate" 2>/dev/null)
      if [ -n "$SECRET_CHECK" ]; then
        CONFIG_FILE="$candidate"
        break
      fi
    fi
  done
fi

if [ -z "$CONFIG_FILE" ] || [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: Config file not found or no OTP secret configured" >&2
  exit 2
fi

CODE="${1}"
USER_ID="${2:-default}"

if [ -z "$CODE" ]; then
  echo "Usage: verify.sh <code> [userId]" >&2
  exit 2
fi

# Extract secret from config
SECRET=$(jq -r '.auth.otpVerification.secret // empty' "$CONFIG_FILE")

if [ -z "$SECRET" ]; then
  echo "ERROR: No OTP secret configured at auth.otpVerification.secret" >&2
  exit 2
fi

# Validate the code
if ! "$TOTP_CLI" validate "$SECRET" "$CODE" >/dev/null 2>&1; then
  echo "INVALID"
  exit 1
fi

# Code is valid - update state
mkdir -p "$(dirname "$STATE_FILE")"

# Create state file if it doesn't exist
if [ ! -f "$STATE_FILE" ]; then
  echo '{}' > "$STATE_FILE"
fi

# Get interval hours from config (default 24)
INTERVAL_HOURS=$(jq -r '.auth.otpVerification.intervalHours // 24' "$CONFIG_FILE")

# Calculate expiration timestamp
NOW_MS=$(date +%s)000
EXPIRES_MS=$((NOW_MS + (INTERVAL_HOURS * 60 * 60 * 1000)))

# Update state
jq --arg userId "$USER_ID" \
   --arg lastVerified "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" \
   --arg expiresAt "$(date -u -d @$((EXPIRES_MS / 1000)) +%Y-%m-%dT%H:%M:%S.000Z)" \
   '.[$userId] = {lastVerified: $lastVerified, expiresAt: $expiresAt}' \
   "$STATE_FILE" > "$STATE_FILE.tmp"

mv "$STATE_FILE.tmp" "$STATE_FILE"

echo "VERIFIED"
exit 0
